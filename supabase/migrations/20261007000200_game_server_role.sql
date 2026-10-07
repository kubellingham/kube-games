-- A dedicated login for the app server, so it doesn't need the database owner's
-- password. It can read and write the game tables and run room cleanup, nothing else.
-- Its password is set per environment (never in a migration):
--   alter role kube_games_server password '...';
-- and given to the server as DATABASE_USER / DATABASE_PASSWORD (see .env.example).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'kube_games_server') then
    create role kube_games_server login;
  end if;
end;
$$;

grant usage on schema public to kube_games_server;
grant select, insert, update, delete on table public.game_rooms, public.game_room_players to kube_games_server;

grant usage on schema private to kube_games_server;
grant execute on function private.cleanup_game_rooms(interval, interval) to kube_games_server;

-- Both tables have RLS enabled; the server role sees and changes every row.
create policy "Game server manages rooms"
  on public.game_rooms
  for all
  to kube_games_server
  using (true)
  with check (true);

create policy "Game server manages seats"
  on public.game_room_players
  for all
  to kube_games_server
  using (true)
  with check (true);
