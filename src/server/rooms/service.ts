import "server-only";
import { randomInt } from "node:crypto";
import type { EnginePlayer, GameEngine } from "@/games/multiplayer/engine";
import {
  generateRoomCode,
  isValidRoomCode,
  PLAYER_TIMEOUT_MS,
  sanitizeDisplayName,
} from "@/games/multiplayer/rules";
import type { RoomEndReason, RoomPreview, RoomSnapshot, RoomStatus } from "@/games/multiplayer/types";
import { getGame } from "@/games/registry";
import { getPool, withTransaction, type Db } from "../db";
import { ApiError } from "../http";
import { getOnlineEngine } from "./engines";

/*
 * Generic room lifecycle shared by every online game.
 *
 * Concurrency: every operation that changes a room starts by locking the room
 * row (SELECT ... FOR UPDATE) inside a transaction, so changes to one room are
 * applied strictly one after another. Two players submitting at the same moment
 * cannot both see "one move missing", cannot resolve a round twice, and cannot
 * both take the last seat.
 */

interface RoomRow {
  id: string;
  code: string;
  game_id: string;
  status: RoomStatus;
  ended_reason: RoomEndReason | null;
  is_public: boolean;
  max_players: number;
  options: unknown;
  state: unknown;
  rematch_votes: string[];
  version: number;
}

interface PlayerRow {
  user_id: string;
  seat: number;
  display_name: string;
  secret_state: unknown;
  left_at: Date | null;
  /** Milliseconds since the player's last heartbeat, measured by the database clock. */
  idle_ms: number;
}

const roomColumns = (alias = "") =>
  ["id", "code", "game_id", "status", "ended_reason", "is_public", "max_players", "options", "state", "rematch_votes", "version"]
    .map((column) => (alias ? `${alias}.${column}` : column))
    .join(", ");

const PLAYER_COLUMNS =
  "user_id, seat, display_name, secret_state, left_at, (extract(epoch from now() - last_seen_at) * 1000)::float8 as idle_ms";

const roomNotFound = () =>
  new ApiError(404, "ROOM_NOT_FOUND", "We couldn't find a room with that code. Check it and try again.");
const roomClosed = (message: string) => new ApiError(410, "ROOM_CLOSED", message);
const notInRoom = (preview?: RoomPreview) =>
  new ApiError(403, "NOT_IN_ROOM", "You're not a player in this room.", preview);

const isActive = (player: PlayerRow) => player.left_at === null;

function requireCode(code: string): string {
  if (!isValidRoomCode(code)) {
    throw new ApiError(400, "INVALID_ROOM_CODE", "Room codes are 6 letters and numbers, like K7F3QX.");
  }
  return code;
}

function requireDisplayName(raw: unknown): string {
  const name = sanitizeDisplayName(raw);
  if (!name) throw new ApiError(400, "INVALID_NAME", "Enter a display name (up to 24 characters).");
  return name;
}

function requireEngine(gameId: unknown): GameEngine {
  const engine = typeof gameId === "string" ? getOnlineEngine(gameId) : undefined;
  if (!engine) throw new ApiError(404, "UNKNOWN_GAME", "That game isn't available online.");
  return engine;
}

function engineFor(room: RoomRow): GameEngine {
  const engine = getOnlineEngine(room.game_id);
  if (!engine) throw roomClosed("This game is no longer available online.");
  return engine;
}

const toJson = (value: unknown) => (value === null || value === undefined ? null : JSON.stringify(value));

function enginePlayers(players: PlayerRow[]): EnginePlayer[] {
  return players.filter(isActive).map((p) => ({ userId: p.user_id, seat: p.seat }));
}

function secretsOf(players: PlayerRow[]): Record<string, unknown> {
  return Object.fromEntries(players.filter(isActive).map((p) => [p.user_id, p.secret_state ?? null]));
}

function toSnapshot(room: RoomRow, players: PlayerRow[], viewerId: string): RoomSnapshot {
  const viewer = players.find((p) => p.user_id === viewerId);
  if (!viewer) throw new Error("Snapshots can only be built for players in the room");
  return {
    id: room.id,
    code: room.code,
    gameId: room.game_id,
    status: room.status,
    endedReason: room.ended_reason,
    isPublic: room.is_public,
    maxPlayers: room.max_players,
    options: room.options,
    version: room.version,
    players: players.map((p) => ({
      userId: p.user_id,
      seat: p.seat,
      displayName: p.display_name,
      isHost: p.seat === 0,
      hasLeft: !isActive(p),
    })),
    rematchVotes: room.rematch_votes,
    you: { userId: viewerId, seat: viewer.seat },
    // Only the viewer's own secret is ever included, never another player's.
    game: room.state === null ? null : { state: room.state, secret: viewer.secret_state ?? null },
  };
}

function toPreview(room: RoomRow, players: PlayerRow[]): RoomPreview {
  return {
    code: room.code,
    gameId: room.game_id,
    status: room.status,
    hostName: players.find((p) => p.seat === 0)?.display_name ?? null,
    playerCount: players.filter(isActive).length,
    maxPlayers: room.max_players,
  };
}

async function lockRoom(db: Db, code: string): Promise<RoomRow | null> {
  const { rows } = await db.query<RoomRow>(
    `select ${roomColumns()} from public.game_rooms where code = $1 for update`,
    [code],
  );
  return rows[0] ?? null;
}

async function loadPlayers(db: Db, roomId: string): Promise<PlayerRow[]> {
  const { rows } = await db.query<PlayerRow>(
    `select ${PLAYER_COLUMNS} from public.game_room_players where room_id = $1 order by seat`,
    [roomId],
  );
  return rows;
}

/** Locks a room and checks the caller is still seated in it. */
async function lockMembership(db: Db, code: string, userId: string) {
  const room = await lockRoom(db, code);
  if (!room) throw roomNotFound();
  const players = await loadPlayers(db, room.id);
  if (!players.some((p) => p.user_id === userId && isActive(p))) throw notInRoom();
  return { room, players };
}

interface RoomUpdate {
  status?: RoomStatus;
  endedReason?: RoomEndReason | null;
  state?: unknown;
  rematchVotes?: string[];
}

/** Writes a change and bumps the version, which also notifies Realtime subscribers. */
async function updateRoom(db: Db, room: RoomRow, update: RoomUpdate): Promise<RoomRow> {
  const { rows } = await db.query<RoomRow>(
    `update public.game_rooms
        set status = $2, ended_reason = $3, state = $4::jsonb, rematch_votes = $5::uuid[],
            version = version + 1, updated_at = now()
      where id = $1
      returning ${roomColumns()}`,
    [
      room.id,
      update.status ?? room.status,
      update.endedReason !== undefined ? update.endedReason : room.ended_reason,
      toJson(update.state !== undefined ? update.state : room.state),
      update.rematchVotes ?? room.rematch_votes,
    ],
  );
  return rows[0];
}

async function saveSecrets(
  db: Db,
  roomId: string,
  players: PlayerRow[],
  secrets: Record<string, unknown> | undefined,
): Promise<PlayerRow[]> {
  if (!secrets) return players;
  const seated = new Set(players.filter(isActive).map((p) => p.user_id));
  for (const [userId, secret] of Object.entries(secrets)) {
    if (!seated.has(userId)) throw new Error(`Engine returned a secret for a player who is not seated: ${userId}`);
    await db.query(
      "update public.game_room_players set secret_state = $3::jsonb where room_id = $1 and user_id = $2",
      [roomId, userId, toJson(secret)],
    );
  }
  return players.map((p) => (Object.hasOwn(secrets, p.user_id) ? { ...p, secret_state: secrets[p.user_id] } : p));
}

async function touchPlayer(db: Db, roomId: string, userId: string): Promise<void> {
  await db.query("update public.game_room_players set last_seen_at = now() where room_id = $1 and user_id = $2", [
    roomId,
    userId,
  ]);
}

async function insertRoom(
  db: Db,
  userId: string,
  displayName: string,
  engine: GameEngine,
  options: unknown,
  isPublic: boolean,
): Promise<RoomSnapshot> {
  // A player hosts at most one waiting room; opening a new one replaces the old.
  await db.query(
    `delete from public.game_rooms r
      using public.game_room_players p
      where p.room_id = r.id and p.user_id = $1 and p.seat = 0 and r.status = 'waiting'`,
    [userId],
  );

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode((max) => randomInt(max));
    const { rows } = await db.query<RoomRow>(
      `insert into public.game_rooms (code, game_id, is_public, max_players, options)
       values ($1, $2, $3, $4, $5::jsonb)
       on conflict (code) do nothing
       returning ${roomColumns()}`,
      [code, engine.gameId, isPublic, engine.seats, JSON.stringify(options)],
    );
    const room = rows[0];
    if (!room) continue; // Code already in use; try another.

    const { rows: players } = await db.query<PlayerRow>(
      `insert into public.game_room_players (room_id, user_id, seat, display_name)
       values ($1, $2, 0, $3)
       returning ${PLAYER_COLUMNS}`,
      [room.id, userId, displayName],
    );
    return toSnapshot(room, players, userId);
  }
  throw new Error("Could not allocate a unique room code");
}

/** Seats a player in a locked room, starting the game once every seat is filled. */
async function seatPlayer(
  db: Db,
  room: RoomRow,
  players: PlayerRow[],
  userId: string,
  displayName: string,
  engine: GameEngine,
): Promise<RoomSnapshot> {
  const existing = players.find((p) => p.user_id === userId);
  if (existing && isActive(existing)) {
    // Already seated, e.g. reopening the invite link after a refresh.
    await touchPlayer(db, room.id, userId);
    return toSnapshot(room, players, userId);
  }
  if (existing) throw roomClosed("You left this room. Start a new game to play again.");
  if (room.status === "finished") throw roomClosed("This game has already finished.");

  const active = players.filter(isActive);
  if (room.status !== "waiting" || active.length >= room.max_players) {
    throw new ApiError(409, "ROOM_FULL", "This room is already full.");
  }
  if (active.every((p) => p.idle_ms > PLAYER_TIMEOUT_MS)) {
    throw new ApiError(410, "ROOM_EXPIRED", "This room has expired. Ask your friend for a new code.");
  }

  const takenSeats = new Set(players.map((p) => p.seat));
  let seat = 0;
  while (takenSeats.has(seat)) seat++;

  const { rows } = await db.query<PlayerRow>(
    `insert into public.game_room_players (room_id, user_id, seat, display_name)
     values ($1, $2, $3, $4)
     returning ${PLAYER_COLUMNS}`,
    [room.id, userId, seat, displayName],
  );
  let seated = [...players, rows[0]].sort((a, b) => a.seat - b.seat);

  if (seated.filter(isActive).length < engine.seats) {
    return toSnapshot(await updateRoom(db, room, {}), seated, userId);
  }

  const start = engine.start(enginePlayers(seated), room.options);
  seated = await saveSecrets(db, room.id, seated, start.secrets);
  const started = await updateRoom(db, room, { status: "playing", state: start.state });
  return toSnapshot(started, seated, userId);
}

export async function createRoom(
  userId: string,
  input: { gameId: unknown; displayName: unknown; options?: unknown },
): Promise<RoomSnapshot> {
  const engine = requireEngine(input.gameId);
  const displayName = requireDisplayName(input.displayName);
  const options = engine.parseOptions(input.options);
  return withTransaction((db) => insertRoom(db, userId, displayName, engine, options, false));
}

export async function quickMatch(
  userId: string,
  input: { gameId: unknown; displayName: unknown },
): Promise<RoomSnapshot> {
  const engine = requireEngine(input.gameId);
  if (!getGame(engine.gameId)?.online?.quickMatch) {
    throw new ApiError(400, "QUICK_MATCH_UNAVAILABLE", "Quick match isn't available for this game.");
  }
  const displayName = requireDisplayName(input.displayName);

  return withTransaction(async (db) => {
    // Matchmaking for a game runs one request at a time, so two players searching
    // at the same moment pair up instead of each opening their own room.
    await db.query("select pg_advisory_xact_lock(hashtext($1))", [`quick-match:${engine.gameId}`]);

    const { rows: mine } = await db.query<RoomRow>(
      `select ${roomColumns("r")}
         from public.game_rooms r
         join public.game_room_players p on p.room_id = r.id
        where p.user_id = $1 and p.left_at is null
          and r.game_id = $2 and r.is_public and r.status = 'waiting'
        limit 1
        for update of r`,
      [userId, engine.gameId],
    );
    if (mine[0]) {
      await touchPlayer(db, mine[0].id, userId);
      return toSnapshot(mine[0], await loadPlayers(db, mine[0].id), userId);
    }

    const { rows: open } = await db.query<RoomRow>(
      `select ${roomColumns("r")}
         from public.game_rooms r
        where r.game_id = $1 and r.is_public and r.status = 'waiting'
          and exists (
            select 1 from public.game_room_players p
             where p.room_id = r.id and p.left_at is null
               and p.last_seen_at > now() - make_interval(secs => $2)
          )
        order by r.created_at
        limit 1
        for update of r skip locked`,
      [engine.gameId, PLAYER_TIMEOUT_MS / 1000],
    );
    if (open[0]) {
      return seatPlayer(db, open[0], await loadPlayers(db, open[0].id), userId, displayName, engine);
    }

    return insertRoom(db, userId, displayName, engine, engine.parseOptions(undefined), true);
  });
}

export async function joinRoom(userId: string, rawCode: string, input: { displayName: unknown }): Promise<RoomSnapshot> {
  const code = requireCode(rawCode);
  const displayName = requireDisplayName(input.displayName);
  return withTransaction(async (db) => {
    const room = await lockRoom(db, code);
    if (!room) throw roomNotFound();
    return seatPlayer(db, room, await loadPlayers(db, room.id), userId, displayName, engineFor(room));
  });
}

export async function getRoom(userId: string, rawCode: string): Promise<RoomSnapshot> {
  const code = requireCode(rawCode);
  return withTransaction(
    async (db) => {
      const { rows } = await db.query<RoomRow>(`select ${roomColumns()} from public.game_rooms where code = $1`, [code]);
      const room = rows[0];
      if (!room) throw roomNotFound();
      const players = await loadPlayers(db, room.id);
      if (!players.some((p) => p.user_id === userId)) throw notInRoom(toPreview(room, players));
      return toSnapshot(room, players, userId);
    },
    { readOnly: true },
  );
}

export async function performAction(userId: string, rawCode: string, rawAction: unknown): Promise<RoomSnapshot> {
  const code = requireCode(rawCode);
  return withTransaction(async (db) => {
    const { room, players } = await lockMembership(db, code, userId);
    if (room.status !== "playing") {
      throw new ApiError(
        409,
        "GAME_NOT_ACTIVE",
        room.status === "waiting" ? "The game starts once your opponent joins." : "This game is over.",
      );
    }
    const engine = engineFor(room);
    const result = engine.applyAction(
      { state: room.state, options: room.options, players: enginePlayers(players), secrets: secretsOf(players) },
      userId,
      engine.parseAction(rawAction),
    );
    const updatedPlayers = await saveSecrets(db, room.id, players, result.secrets);
    const updated = await updateRoom(
      db,
      room,
      result.finished
        ? { state: result.state, status: "finished", endedReason: "completed" }
        : { state: result.state },
    );
    return toSnapshot(updated, updatedPlayers, userId);
  });
}

export async function requestRematch(userId: string, rawCode: string): Promise<RoomSnapshot> {
  const code = requireCode(rawCode);
  return withTransaction(async (db) => {
    const { room, players } = await lockMembership(db, code, userId);
    const engine = engineFor(room);
    if (room.status !== "finished" || room.ended_reason !== "completed") {
      throw new ApiError(409, "REMATCH_UNAVAILABLE", "A rematch isn't available right now.");
    }
    if (players.filter(isActive).length < engine.seats) {
      throw new ApiError(409, "REMATCH_UNAVAILABLE", "Your opponent has left the room.");
    }
    if (room.rematch_votes.includes(userId)) return toSnapshot(room, players, userId);

    const votes = [...room.rematch_votes, userId];
    if (!players.filter(isActive).every((p) => votes.includes(p.user_id))) {
      return toSnapshot(await updateRoom(db, room, { rematchVotes: votes }), players, userId);
    }

    const start = engine.start(enginePlayers(players), room.options);
    const updatedPlayers = await saveSecrets(db, room.id, players, start.secrets);
    const restarted = await updateRoom(db, room, {
      status: "playing",
      endedReason: null,
      state: start.state,
      rematchVotes: [],
    });
    return toSnapshot(restarted, updatedPlayers, userId);
  });
}

export async function leaveRoom(userId: string, rawCode: string): Promise<void> {
  const code = requireCode(rawCode);
  await withTransaction(async (db) => {
    const room = await lockRoom(db, code);
    if (!room) return;
    const players = await loadPlayers(db, room.id);
    const me = players.find((p) => p.user_id === userId && isActive(p));
    if (!me) return;

    const others = players.filter((p) => isActive(p) && p.user_id !== userId);
    if (others.length === 0 || (room.status === "waiting" && me.seat === 0)) {
      // Nobody left to play with, or the host cancelled before the game started.
      await db.query("delete from public.game_rooms where id = $1", [room.id]);
      return;
    }

    if (room.status === "waiting") {
      await db.query("delete from public.game_room_players where room_id = $1 and user_id = $2", [room.id, userId]);
      await updateRoom(db, room, {});
      return;
    }

    await db.query(
      "update public.game_room_players set left_at = now(), secret_state = null where room_id = $1 and user_id = $2",
      [room.id, userId],
    );
    await updateRoom(
      db,
      room,
      room.status === "playing"
        ? { status: "finished", endedReason: "player_left", rematchVotes: [] }
        : { rematchVotes: [] },
    );
  });
}

/** Records that the player still has the room open and returns the room's current version. */
export async function recordHeartbeat(userId: string, rawCode: string): Promise<{ version: number }> {
  const code = requireCode(rawCode);
  // Deliberately does not touch game_rooms, so heartbeats don't trigger Realtime events.
  const { rows } = await getPool().query<{ version: number }>(
    `update public.game_room_players p
        set last_seen_at = now()
       from public.game_rooms r
      where r.id = p.room_id and r.code = $1 and p.user_id = $2 and p.left_at is null
      returning r.version`,
    [code, userId],
  );
  if (!rows[0]) throw notInRoom();
  return { version: rows[0].version };
}

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanupAt = 0;

/** Deletes abandoned rooms. Throttled per server instance; never throws. */
export async function cleanupStaleRooms(): Promise<void> {
  if (Date.now() - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = Date.now();
  try {
    await getPool().query("select private.cleanup_game_rooms()");
  } catch (error) {
    console.error("Failed to clean up stale game rooms", error);
  }
}
