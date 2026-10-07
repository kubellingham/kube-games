# Kube Games

A game hub where players browse a library of games and play them solo against the
computer or online against other people in real time. The first game is
**Rock Paper Scissors**; the platform is built so new games plug in without
touching the library, lobby or multiplayer plumbing.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript ·
Tailwind CSS v4 · Supabase (Postgres, anonymous Auth, Realtime) · Vitest · Playwright.

## Getting started

Requirements: Node 22+, Docker (for the local Supabase stack).

```bash
npm install
npx supabase start          # local Postgres, Auth and Realtime; applies supabase/migrations
cp .env.example .env.local  # the defaults point at the local stack
npm run dev                 # http://localhost:3000
```

The vs-computer mode works without Supabase; online play needs it.

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run typecheck` | Generates route types and runs `tsc` |
| `npm run lint` | ESLint (Next.js + React Compiler rules) |
| `npm test` | Unit tests (rules, engine, registry, validation) |
| `npm run test:db` | Room service integration tests against the local Supabase database, including concurrency and RLS |
| `npm run test:e2e` | Playwright: two real browsers playing each other, desktop and mobile |
| `npm run db:reset` | Recreate the local database from the migrations |

## Routes

| Route | Page |
| --- | --- |
| `/games` | Game library (`/` redirects here) |
| `/games/[gameId]` | A game's page: description, modes, how to play |
| `/games/[gameId]/play` | Play against the computer |
| `/games/[gameId]/online` | Multiplayer lobby: quick match, create room, join by code (`?code=` prefills) |
| `/games/[gameId]/room/[code]` | An online room. Also the invite link: opening it lets a friend join |

Every route is generic: pages look the game up in the registry and render its components.

## Project structure

```
src/
  app/                         Routes (pages + API route handlers)
    api/rooms/...              Room API: create, quick-match, get, join, actions, rematch, leave, heartbeat
  games/
    registry.ts                Every game's metadata (the library is built from this)
    game-components.tsx        Each game's UI per mode, lazy-loaded
    types.ts, modes.ts, routes.ts
    components/                Generic UI: GameCard, GameLibrary, GameShell, ScoreBoard, PlayerIndicator,
                               GameStatus, RoomCode, MultiplayerLobby, RoomScreen, WaitingRoom, ...
    multiplayer/
      engine.ts                GameEngine interface implemented by every online game
      types.ts, rules.ts       Room snapshot types; room code, name and timing rules
      client/                  API client, anonymous session, useGameRoom (Realtime sync) hook
    rock-paper-scissors/
      definition.ts            Registry metadata
      logic/                   Pure rules shared by every mode (+ tests)
      multiplayer/             Server engine and state types (+ tests)
      components/              Move picker, reveal, history, vs-computer and online UIs
  server/
    auth.ts                    Verifies the caller's Supabase JWT
    db.ts                      Postgres pool and transactions
    rooms/service.ts           Room lifecycle for every game (+ integration tests)
    rooms/engines.ts           Online game engines, keyed by game id
supabase/migrations/           Schema, RLS, Realtime publication, cleanup job
e2e/                           Playwright tests
```

## How online multiplayer works

```
Browser A ──POST /api/rooms/K7F3QX/actions──▶ Next.js route handler
                                                 │ verify JWT → user id
                                                 │ BEGIN; SELECT room FOR UPDATE
                                                 │ engine.applyAction(state, secrets, user, action)
                                                 │ UPDATE room (public state, version+1), player secrets; COMMIT
Browser B ◀── Realtime: "room row changed" ───── Postgres ──▶ Supabase Realtime (RLS: members only)
Browser B ──GET /api/rooms/K7F3QX──────────────▶ B's own view of the room (never A's secrets)
```

- **Identity.** Each browser signs in with Supabase anonymous auth on first online visit.
  The session lives in localStorage, so refreshing keeps the same player and seat.
  The server takes the user id from the verified JWT, never from the request body.
- **Server authority.** All game rules run on the server. A game's `GameEngine`
  (`src/games/multiplayer/engine.ts`) is a set of pure functions: `start`,
  `parseAction`, `applyAction`. The generic room service loads the room under a row lock,
  calls the engine and saves the result in one transaction. Clients only send intents
  (`{ type: "submit_move", round: 3, move: "rock" }`) and never decide winners or scores.
- **Hidden information.** State has two parts: public `game_rooms.state`, which every player
  in the room can see, and per-player `game_room_players.secret_state`, which no client role
  can read at all. A snapshot includes only the viewer's own secret. In Rock Paper Scissors a
  locked-in move is a secret until both players have played. The public state then says only
  *who* has locked in, and both moves are written to it in the same transaction that reveals them.
- **Realtime.** Browsers subscribe to `postgres_changes` on their room row. RLS lets only
  seated players read a room, so Realtime only notifies members, and the row never holds
  secrets. On a change the client refetches its own snapshot. Presence on the same channel
  shows who has the room open, and drives the "Opponent disconnected" banner.
- **Staying in sync.** Realtime can drop change events while the socket stays connected
  (e.g. when it restarts replication), so it is never the only signal. The client also
  refetches when (re)subscribing, when the tab becomes visible, and when the network
  comes back. It polls while Realtime is down. Every 10 s heartbeat returns the room's
  version, and a newer version triggers a refetch. Snapshots carry a version, so
  out-of-order responses are discarded. An e2e test drops all change events and checks
  that the game still progresses.

### Concurrency

Every operation that changes a room starts with `SELECT … FOR UPDATE` on the room row, so
operations on one room run strictly one after another:

- Two simultaneous moves: the second transaction waits, then sees the first move and resolves
  the round. It resolves exactly once and scores exactly once.
- A double-submitted move: the second is rejected (`ALREADY_SUBMITTED`). Moves carry the round
  number, so a late move can't land in the next round (`ROUND_MISMATCH`).
- Several players racing for the last seat: exactly one gets it; the rest get `ROOM_FULL`.
- Quick match takes a per-game advisory lock, so two players searching at once are paired
  instead of each opening a room.

`npm run test:db` exercises each of these with truly concurrent requests.

### Room lifecycle and cleanup

- `waiting` → `playing` when every seat is filled (the game starts automatically).
- `playing` → `finished` when the match is won (`completed`) or a player leaves (`player_left`).
- A finished match can be restarted when every player votes for a rematch.
- A host who cancels a waiting room deletes it. A room is deleted when its last player leaves.
- A waiting room whose host hasn't sent a heartbeat for 90 s can't be joined ("Room has expired").
- `private.cleanup_game_rooms()` deletes rooms idle for 10 minutes or older than 12 hours.
  The server runs it opportunistically when rooms are created; the migration also schedules it
  every 5 minutes with `pg_cron` where that extension is available.

## Adding a game

Say you're adding Tic Tac Toe (`tic-tac-toe`, already listed as "coming soon"):

1. **Implement it** in `src/games/tic-tac-toe/`:
   - `logic/`: pure rules (win detection, a computer opponent), with unit tests.
   - `components/computer-game.tsx`: the vs-computer UI.
   - For online play: `multiplayer/engine.ts`, which implements `GameEngine`
     (`seats`, `parseOptions`, `parseAction`, `start`, `applyAction`; throw `GameRuleError`
     for illegal moves), and `components/online-game.tsx`, which receives `OnlineGameProps`
     (`room`, `act`, `rematch`, `onlineIds`, `leave`). Put anything players must not see
     in secrets.
2. **Register its metadata** in `src/games/registry.ts`: set `availability: "available"`
   and list its `modes`.
3. **Register its implementations**: add its components to `GAME_COMPONENTS` in
   `src/games/game-components.tsx`, and (for online play) its engine to `GAME_ENGINES` in
   `src/server/rooms/engines.ts`.

No new routes, tables, API endpoints or Realtime channels are needed. `registry.test.ts`
fails if a game lists a mode it doesn't implement.

## Deploying

1. **Supabase project:** link it (`npx supabase link`) and apply the migrations
   (`npx supabase db push`). In the dashboard, enable **Authentication → Sign In / Providers →
   Allow anonymous sign-ins**. Consider enabling CAPTCHA and reviewing the anonymous sign-in
   rate limit for production.
2. **Environment variables** (e.g. in Vercel):

   | Variable | Where | Value |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | public | Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Publishable key (`sb_publishable_…`) or legacy anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` also works) |
   | `DATABASE_URL` | **server only** | Pooler connection string, transaction mode (port 6543) |
   | `DATABASE_POOL_MAX` | server, optional | Connections per server instance (default 5) |

   The browser only gets the URL and publishable key; all access is enforced by RLS and the
   server. No service-role key is used anywhere.

## Known limitations

- API requests aren't rate-limited beyond Supabase's anonymous sign-in limits. Add rate
  limiting (e.g. at the edge) before a public launch.
- Presence uses a public Realtime channel named after the room's id. The id is only ever
  given to room members, and presence carries only player ids. Making the channel private
  (Realtime authorization policies) would harden this further.
- Rooms start automatically when full. Games with a variable player count (e.g. 2–8) would
  add a host "start" action to the room service.
