-- Multiplayer rooms shared by every game in the library.
--
-- Security model:
--   * Every write goes through the Next.js server (route handlers using a direct
--     Postgres connection), which verifies the caller's Supabase JWT and runs the
--     game rules inside a transaction. Browsers never write to these tables.
--   * Browsers get SELECT on the rooms they are seated in, and nothing else. That
--     privilege is what Supabase Realtime checks before delivering a change event,
--     so only room members are notified about a room.
--   * Hidden per-player data (e.g. a locked-in move) lives in
--     game_room_players.secret_state. No client role can read that table at all,
--     and the public game_rooms.state never contains unrevealed information.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  -- Unambiguous alphabet (no 0/O, 1/I/L) so codes are easy to read aloud.
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  game_id text not null check (game_id ~ '^[a-z0-9-]{1,64}$'),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  ended_reason text check (ended_reason in ('completed', 'player_left')),
  is_public boolean not null default false,
  max_players smallint not null check (max_players between 1 and 16),
  options jsonb not null default '{}'::jsonb,
  -- Public game state, visible to everyone in the room. Null until the game starts.
  state jsonb,
  rematch_votes uuid[] not null default '{}',
  -- Incremented on every change so clients can discard stale snapshots.
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_rooms_ended_reason_matches_status
    check ((status = 'finished') = (ended_reason is not null))
);

comment on table public.game_rooms is
  'Multiplayer rooms for every game. Written only by the app server; members may read their own rooms.';

create index game_rooms_quick_match_idx
  on public.game_rooms (game_id, created_at)
  where status = 'waiting' and is_public;

create index game_rooms_updated_at_idx on public.game_rooms (updated_at);

create table public.game_room_players (
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seat smallint not null check (seat >= 0),
  display_name text not null check (char_length(display_name) between 1 and 24),
  -- Private to this player and the server, e.g. {"round": 3, "move": "rock"}.
  secret_state jsonb,
  joined_at timestamptz not null default now(),
  -- Refreshed by client heartbeats; used to detect abandoned rooms.
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, user_id),
  unique (room_id, seat)
);

comment on table public.game_room_players is
  'Seats in a game room. Contains hidden per-player state, so no client role has access.';

create index game_room_players_user_id_idx on public.game_room_players (user_id);

-- Lock the tables down explicitly instead of relying on Supabase default grants.
revoke all on table public.game_rooms from anon, authenticated;
revoke all on table public.game_room_players from anon, authenticated;
grant select on table public.game_rooms to authenticated;

alter table public.game_rooms enable row level security;
-- RLS with no policies: denies every client role, even if someone later grants access.
alter table public.game_room_players enable row level security;

-- SECURITY DEFINER so the policy can check membership without giving clients
-- access to game_room_players (which holds secret_state). It lives in the
-- private schema, so it is not exposed as a PostgREST RPC endpoint.
create function private.is_game_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_room_players p
    where p.room_id = p_room_id
      and p.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_game_room_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_game_room_member(uuid) to authenticated;

create policy "Players can read rooms they are seated in"
  on public.game_rooms
  for select
  to authenticated
  using ((select private.is_game_room_member(id)));

-- Realtime: members receive UPDATE events for their room (filtered by RLS above).
alter publication supabase_realtime add table public.game_rooms;

-- Deletes rooms nobody is using any more. Called opportunistically by the app
-- server and, when pg_cron is available, on a schedule.
create function private.cleanup_game_rooms(
  p_idle_after interval default interval '10 minutes',
  p_max_age interval default interval '12 hours'
)
returns integer
language sql
security definer
set search_path = ''
as $$
  with stale as (
    select r.id
    from public.game_rooms r
    where r.created_at < now() - p_max_age
       or greatest(
            r.updated_at,
            (
              select max(p.last_seen_at)
              from public.game_room_players p
              where p.room_id = r.id and p.left_at is null
            )
          ) < now() - p_idle_after
    -- Never wait on a room another transaction is using; it is clearly not idle.
    for update of r skip locked
  ),
  deleted as (
    delete from public.game_rooms r
    using stale
    where r.id = stale.id
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function private.cleanup_game_rooms(interval, interval) from public;
