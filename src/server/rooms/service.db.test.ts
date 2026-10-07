/**
 * Integration tests for the room service against a real Supabase Postgres.
 * Run with `npm run test:db` while the local stack is up (`npx supabase start`).
 * Uses TEST_DATABASE_URL (never DATABASE_URL) so it can't hit a real database by accident.
 */
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RoomSnapshot } from "@/games/multiplayer/types";
import type { RpsSecret, RpsState } from "@/games/rock-paper-scissors/multiplayer/types";
import { getPool } from "../db";
import * as service from "./service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;

type RpsSnapshot = RoomSnapshot<RpsState, RpsSecret>;

describe.skipIf(!testDatabaseUrl)("room service (database)", () => {
  let pool: Pool;
  const createdUsers: string[] = [];

  async function createUser(): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      "insert into auth.users (id, aud, role, is_anonymous) values (gen_random_uuid(), 'authenticated', 'authenticated', true) returning id",
    );
    createdUsers.push(rows[0].id);
    return rows[0].id;
  }

  async function errorCode(promise: Promise<unknown>): Promise<string> {
    try {
      await promise;
    } catch (error) {
      return (error as { code: string }).code;
    }
    throw new Error("Expected the operation to fail");
  }

  async function startedRoom(options?: unknown) {
    const alice = await createUser();
    const bob = await createUser();
    const created = await service.createRoom(alice, {
      gameId: "rock-paper-scissors",
      displayName: "Alice",
      options,
    });
    const joined = (await service.joinRoom(bob, created.code, { displayName: "Bob" })) as RpsSnapshot;
    return { alice, bob, code: created.code, joined };
  }

  const move = (round: number, m: "rock" | "paper" | "scissors") => ({ type: "submit_move", round, move: m });

  beforeAll(() => {
    pool = getPool();
  });

  afterAll(async () => {
    if (createdUsers.length) {
      // Cascades to their rooms and seats.
      await pool.query("delete from auth.users where id = any($1::uuid[])", [createdUsers]);
    }
    await pool.end();
    globalThis.__kubeGamesPool = undefined;
  });

  it("creates a waiting room with the creator in seat 0", async () => {
    const alice = await createUser();
    const room = await service.createRoom(alice, { gameId: "rock-paper-scissors", displayName: "  Alice  " });
    expect(room).toMatchObject({ status: "waiting", gameId: "rock-paper-scissors", maxPlayers: 2, game: null });
    expect(room.code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(room.players).toEqual([{ userId: alice, seat: 0, displayName: "Alice", isHost: true, hasLeft: false }]);
  });

  it("rejects unknown games, bad names and bad options", async () => {
    const alice = await createUser();
    expect(await errorCode(service.createRoom(alice, { gameId: "tic-tac-toe", displayName: "A" }))).toBe("UNKNOWN_GAME");
    expect(await errorCode(service.createRoom(alice, { gameId: "rock-paper-scissors", displayName: " " }))).toBe(
      "INVALID_NAME",
    );
    expect(
      await errorCode(
        service.createRoom(alice, { gameId: "rock-paper-scissors", displayName: "A", options: { targetScore: 99 } }),
      ),
    ).toBe("INVALID_OPTIONS");
  });

  it("validates room codes when joining", async () => {
    const bob = await createUser();
    expect(await errorCode(service.joinRoom(bob, "nope", { displayName: "Bob" }))).toBe("INVALID_ROOM_CODE");
    expect(await errorCode(service.joinRoom(bob, "ZZZZZZ", { displayName: "Bob" }))).toBe("ROOM_NOT_FOUND");
  });

  it("starts the game when the second player joins, and lets players rejoin", async () => {
    const { alice, bob, code, joined } = await startedRoom();
    expect(joined.status).toBe("playing");
    expect(joined.you).toEqual({ userId: bob, seat: 1 });
    expect(joined.game?.state).toMatchObject({ round: 1, scores: { [alice]: 0, [bob]: 0 }, lockedIn: [] });

    const hostView = await service.getRoom(alice, code);
    expect(hostView.players.map((p) => p.displayName)).toEqual(["Alice", "Bob"]);
    expect(hostView.version).toBe(joined.version);

    // Re-joining (e.g. after a refresh) is idempotent.
    const again = await service.joinRoom(bob, code, { displayName: "Bob" });
    expect(again.you.seat).toBe(1);
    expect(again.version).toBe(joined.version);
  });

  it("rejects a third player and non-members", async () => {
    const { code } = await startedRoom();
    const carol = await createUser();
    expect(await errorCode(service.joinRoom(carol, code, { displayName: "Carol" }))).toBe("ROOM_FULL");
    expect(await errorCode(service.performAction(carol, code, move(1, "rock")))).toBe("NOT_IN_ROOM");
    expect(await errorCode(service.recordHeartbeat(carol, code))).toBe("NOT_IN_ROOM");

    const peek = await service.getRoom(carol, code).catch((error) => error);
    expect(peek.code).toBe("NOT_IN_ROOM");
    expect(peek.preview).toMatchObject({ hostName: "Alice", playerCount: 2, status: "playing" });
  });

  it("hides a locked-in move from the opponent until both have played", async () => {
    const { alice, bob, code } = await startedRoom();
    const afterAlice = (await service.performAction(alice, code, move(1, "rock"))) as RpsSnapshot;
    expect(afterAlice.game?.secret).toEqual({ round: 1, move: "rock" });

    const bobView = (await service.getRoom(bob, code)) as RpsSnapshot;
    expect(bobView.game?.state.lockedIn).toEqual([alice]);
    expect(bobView.game?.secret).toBeNull();
    expect(JSON.stringify(bobView.game)).not.toContain('"rock"');

    // The secret is not readable from the public room row either.
    const { rows } = await pool.query("select state::text from public.game_rooms where code = $1", [code]);
    expect(rows[0].state).not.toContain('"rock"');

    const revealed = (await service.performAction(bob, code, move(1, "scissors"))) as RpsSnapshot;
    expect(revealed.game?.state.history[0]).toEqual({
      round: 1,
      moves: { [alice]: "rock", [bob]: "scissors" },
      winnerId: alice,
    });
    expect(revealed.game?.state.scores).toEqual({ [alice]: 1, [bob]: 0 });
    expect(revealed.game?.state.round).toBe(2);
    expect(revealed.game?.secret).toBeNull();
  });

  it("rejects duplicate, stale and premature moves", async () => {
    const alice = await createUser();
    const waiting = await service.createRoom(alice, { gameId: "rock-paper-scissors", displayName: "Alice" });
    expect(await errorCode(service.performAction(alice, waiting.code, move(1, "rock")))).toBe("GAME_NOT_ACTIVE");

    const { alice: a, code } = await startedRoom();
    await service.performAction(a, code, move(1, "rock"));
    expect(await errorCode(service.performAction(a, code, move(1, "paper")))).toBe("ALREADY_SUBMITTED");
    expect(await errorCode(service.performAction(a, code, move(2, "paper")))).toBe("ROUND_MISMATCH");
    expect(await errorCode(service.performAction(a, code, { type: "submit_move", round: 1, move: "lizard" }))).toBe(
      "INVALID_ACTION",
    );
  });

  it("resolves each round exactly once when both players submit simultaneously", async () => {
    const rooms = await Promise.all(Array.from({ length: 8 }, () => startedRoom({ targetScore: null })));

    for (let round = 1; round <= 3; round++) {
      const results = await Promise.allSettled(
        rooms.flatMap(({ alice, bob, code }) => [
          service.performAction(alice, code, move(round, "rock")),
          service.performAction(bob, code, move(round, "scissors")),
        ]),
      );
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    }

    for (const { alice, bob, code } of rooms) {
      const view = (await service.getRoom(alice, code)) as RpsSnapshot;
      expect(view.game?.state.round).toBe(4);
      expect(view.game?.state.history.map((h) => h.round)).toEqual([3, 2, 1]);
      expect(view.game?.state.scores).toEqual({ [alice]: 3, [bob]: 0 });
    }
  });

  it("accepts only one of two simultaneous moves from the same player", async () => {
    const { alice, code } = await startedRoom();
    const results = await Promise.allSettled([
      service.performAction(alice, code, move(1, "rock")),
      service.performAction(alice, code, move(1, "paper")),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.code).toBe("ALREADY_SUBMITTED");
  });

  it("gives the last seat to exactly one of several simultaneous joiners", async () => {
    const host = await createUser();
    const room = await service.createRoom(host, { gameId: "rock-paper-scissors", displayName: "Host" });
    const joiners = await Promise.all(Array.from({ length: 5 }, createUser));
    const results = await Promise.allSettled(
      joiners.map((id, i) => service.joinRoom(id, room.code, { displayName: `Player ${i}` })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      results.filter((r) => r.status === "rejected").map((r) => (r as PromiseRejectedResult).reason.code),
    ).toEqual(["ROOM_FULL", "ROOM_FULL", "ROOM_FULL", "ROOM_FULL"]);
  });

  it("ends the game when a player leaves mid-match", async () => {
    const { alice, bob, code } = await startedRoom();
    await service.leaveRoom(bob, code);
    await service.leaveRoom(bob, code); // Leaving twice is harmless.

    const view = await service.getRoom(alice, code);
    expect(view).toMatchObject({ status: "finished", endedReason: "player_left" });
    expect(view.players.find((p) => p.userId === bob)?.hasLeft).toBe(true);
    expect(await errorCode(service.performAction(alice, code, move(1, "rock")))).toBe("GAME_NOT_ACTIVE");
    expect(await errorCode(service.joinRoom(bob, code, { displayName: "Bob" }))).toBe("ROOM_CLOSED");

    // The room is deleted once the last player leaves.
    await service.leaveRoom(alice, code);
    expect(await errorCode(service.getRoom(alice, code))).toBe("ROOM_NOT_FOUND");
  });

  it("deletes a waiting room when its host leaves", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const room = await service.createRoom(alice, { gameId: "rock-paper-scissors", displayName: "Alice" });
    await service.leaveRoom(alice, room.code);
    expect(await errorCode(service.joinRoom(bob, room.code, { displayName: "Bob" }))).toBe("ROOM_NOT_FOUND");
  });

  it("replaces a host's previous waiting room when they open a new one", async () => {
    const alice = await createUser();
    const first = await service.createRoom(alice, { gameId: "rock-paper-scissors", displayName: "Alice" });
    await service.createRoom(alice, { gameId: "rock-paper-scissors", displayName: "Alice" });
    expect(await errorCode(service.getRoom(alice, first.code))).toBe("ROOM_NOT_FOUND");
  });

  it("refuses to seat players in a room whose host has gone quiet", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const room = await service.createRoom(alice, { gameId: "rock-paper-scissors", displayName: "Alice" });
    await pool.query(
      "update public.game_room_players set last_seen_at = now() - interval '5 minutes' where room_id = $1",
      [room.id],
    );
    expect(await errorCode(service.joinRoom(bob, room.code, { displayName: "Bob" }))).toBe("ROOM_EXPIRED");

    // A heartbeat brings the room back to life, and reports the room's version.
    expect(await service.recordHeartbeat(alice, room.code)).toEqual({ version: room.version });
    expect((await service.joinRoom(bob, room.code, { displayName: "Bob" })).status).toBe("playing");
  });

  it("finishes the match at the target score and restarts when both vote for a rematch", async () => {
    const { alice, bob, code } = await startedRoom({ targetScore: 3 });
    let last: RpsSnapshot | undefined;
    for (let round = 1; round <= 3; round++) {
      await service.performAction(alice, code, move(round, "paper"));
      last = (await service.performAction(bob, code, move(round, "rock"))) as RpsSnapshot;
    }
    expect(last).toMatchObject({ status: "finished", endedReason: "completed" });
    expect(last?.game?.state.matchWinnerId).toBe(alice);

    const voted = await service.requestRematch(alice, code);
    expect(voted.rematchVotes).toEqual([alice]);
    expect(voted.status).toBe("finished");

    const restarted = (await service.requestRematch(bob, code)) as RpsSnapshot;
    expect(restarted.status).toBe("playing");
    expect(restarted.rematchVotes).toEqual([]);
    expect(restarted.game?.state).toMatchObject({ round: 1, scores: { [alice]: 0, [bob]: 0 }, matchWinnerId: null });
  });

  it("pairs quick-match players, including two who search at the same moment", async () => {
    // Clear any open quick-match rooms left over from earlier runs.
    await pool.query("delete from public.game_rooms where is_public and status = 'waiting'");

    const [a, b] = await Promise.all([createUser(), createUser()]);
    const results = await Promise.all([
      service.quickMatch(a, { gameId: "rock-paper-scissors", displayName: "A" }),
      service.quickMatch(b, { gameId: "rock-paper-scissors", displayName: "B" }),
    ]);
    expect(results[0].code).toBe(results[1].code);
    const final = await service.getRoom(a, results[0].code);
    expect(final.status).toBe("playing");
    expect(final.isPublic).toBe(true);

    // Searching again while waiting returns the same room instead of a new one.
    const c = await createUser();
    const waiting = await service.quickMatch(c, { gameId: "rock-paper-scissors", displayName: "C" });
    expect(waiting.status).toBe("waiting");
    expect((await service.quickMatch(c, { gameId: "rock-paper-scissors", displayName: "C" })).code).toBe(waiting.code);
  });

  it("only lets room members read a room through Row Level Security", async () => {
    const { alice, code } = await startedRoom();
    const stranger = await createUser();

    async function asUser(userId: string | null, sql: string, params: unknown[] = []) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        if (userId) {
          await client.query("set local role authenticated");
          await client.query("select set_config('request.jwt.claims', $1, true)", [
            JSON.stringify({ sub: userId, role: "authenticated" }),
          ]);
        } else {
          await client.query("set local role anon");
        }
        return (await client.query(sql, params)).rows;
      } finally {
        await client.query("rollback");
        client.release();
      }
    }

    expect(await asUser(alice, "select code from public.game_rooms where code = $1", [code])).toHaveLength(1);
    expect(await asUser(stranger, "select code from public.game_rooms where code = $1", [code])).toHaveLength(0);
    await expect(asUser(alice, "select secret_state from public.game_room_players")).rejects.toThrow(/permission denied/);
    await expect(asUser(null, "select * from public.game_rooms")).rejects.toThrow(/permission denied/);
    await expect(asUser(alice, "update public.game_rooms set version = 999 where code = $1", [code])).rejects.toThrow(
      /permission denied/,
    );
  });

  it("cleans up rooms that have been idle for too long", async () => {
    const alice = await createUser();
    const room = await service.createRoom(alice, { gameId: "rock-paper-scissors", displayName: "Alice" });
    await pool.query(
      "update public.game_rooms set updated_at = now() - interval '1 hour' where id = $1",
      [room.id],
    );
    await pool.query(
      "update public.game_room_players set last_seen_at = now() - interval '1 hour' where room_id = $1",
      [room.id],
    );
    const { rows } = await pool.query<{ deleted: number }>("select private.cleanup_game_rooms() as deleted");
    expect(rows[0].deleted).toBeGreaterThanOrEqual(1);
    expect(await errorCode(service.getRoom(alice, room.code))).toBe("ROOM_NOT_FOUND");
  });
});
