/**
 * Integration tests for multi-player, turn-based rooms (Snakes & Ladders) against
 * a real Supabase Postgres. Run with `npm run test:db` (see service.db.test.ts).
 */
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RoomSnapshot } from "@/games/multiplayer/types";
import type { SnlState } from "@/games/snakes-and-ladders/logic/types";
import { getPool } from "../db";
import * as service from "./service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;

type SnlSnapshot = RoomSnapshot<SnlState, null>;
const GAME = "snakes-and-ladders";

describe.skipIf(!testDatabaseUrl)("turn-based rooms (database)", () => {
  let pool: Pool;
  const createdUsers: string[] = [];

  beforeAll(() => {
    pool = getPool();
  });

  afterAll(async () => {
    if (createdUsers.length) await pool.query("delete from auth.users where id = any($1::uuid[])", [createdUsers]);
    await pool.end();
    globalThis.__kubeGamesPool = undefined;
  });

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

  /** A room with `count` seated players; host first. */
  async function roomWith(count: number) {
    const ids = await Promise.all(Array.from({ length: count }, createUser));
    const room = await service.createRoom(ids[0], { gameId: GAME, displayName: "Host" });
    for (let i = 1; i < count; i++) await service.joinRoom(ids[i], room.code, { displayName: `P${i}` });
    return { ids, code: room.code };
  }

  const roll = (userId: string, code: string, seq: number) =>
    service.performAction(userId, code, { type: "roll", seq }) as Promise<SnlSnapshot>;

  it("waits for the host to start a 2–4 player game", async () => {
    const { ids, code } = await roomWith(1);
    expect(await errorCode(service.startGame(ids[0], code))).toBe("NOT_ENOUGH_PLAYERS");

    const p1 = await createUser();
    const p2 = await createUser();
    await service.joinRoom(p1, code, { displayName: "P1" });
    const waiting = await service.joinRoom(p2, code, { displayName: "P2" });
    expect(waiting).toMatchObject({ status: "waiting", minPlayers: 2, maxPlayers: 4 });
    expect(await errorCode(service.startGame(p1, code))).toBe("NOT_HOST");

    const started = (await service.startGame(ids[0], code)) as SnlSnapshot;
    expect(started.status).toBe("playing");
    expect(started.game?.state.order).toEqual([ids[0], p1, p2]);
    expect(started.game?.state.turn).toBe(ids[0]);
    expect(started.serverTime).toBeGreaterThan(0);

    // Starting twice is harmless; joining a game in progress isn't allowed.
    expect((await service.startGame(ids[0], code)).status).toBe("playing");
    expect(await errorCode(service.joinRoom(await createUser(), code, { displayName: "Late" }))).toBe("ROOM_FULL");
  });

  it("starts automatically when all four seats are filled", async () => {
    const { code, ids } = await roomWith(4);
    const view = (await service.getRoom(ids[3], code)) as SnlSnapshot;
    expect(view.status).toBe("playing");
    expect(view.game?.state.order).toHaveLength(4);
  });

  it("only lets the current player roll, and only once per roll", async () => {
    const { ids, code } = await roomWith(2);
    await service.startGame(ids[0], code);
    expect(await errorCode(roll(ids[1], code, 0))).toBe("NOT_YOUR_TURN");

    const results = await Promise.allSettled([roll(ids[0], code, 0), roll(ids[0], code, 0), roll(ids[0], code, 0)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const view = (await service.getRoom(ids[1], code)) as SnlSnapshot;
    expect(view.game?.state.rollCount).toBe(1);
    const first = view.game!.state.history[0];
    expect(first.playerId).toBe(ids[0]);
    expect(first.value).toBeGreaterThanOrEqual(1);
    expect(first.value).toBeLessThanOrEqual(6);
  });

  it("rolls for a player who runs out of time, accepting only the first claim", async () => {
    const { ids, code } = await roomWith(3);
    await service.startGame(ids[0], code);
    expect(await errorCode(service.performAction(ids[1], code, { type: "claim_timeout", seq: 0 }))).toBe(
      "TURN_NOT_EXPIRED",
    );

    // Pretend the host's turn started a minute ago.
    await pool.query(
      `update public.game_rooms set state = jsonb_set(state, '{turnStartedAt}', to_jsonb((extract(epoch from now()) * 1000 - 60000)::bigint)) where code = $1`,
      [code],
    );
    const claims = await Promise.allSettled([
      service.performAction(ids[1], code, { type: "claim_timeout", seq: 0 }),
      service.performAction(ids[2], code, { type: "claim_timeout", seq: 0 }),
    ]);
    expect(claims.filter((c) => c.status === "fulfilled")).toHaveLength(1);
    const view = (await service.getRoom(ids[0], code)) as SnlSnapshot;
    expect(view.game?.state.history[0]).toMatchObject({ playerId: ids[0], auto: true });
  });

  it("carries on without a player who leaves, until too few remain", async () => {
    const { ids, code } = await roomWith(3);
    await service.startGame(ids[0], code);

    // The host leaves on their own turn: the game continues and the turn moves on.
    await service.leaveRoom(ids[0], code);
    let view = (await service.getRoom(ids[1], code)) as SnlSnapshot;
    expect(view.status).toBe("playing");
    expect(view.game?.state.order).toEqual([ids[1], ids[2]]);
    expect(view.game?.state.turn).toBe(ids[1]);
    expect(view.players.find((p) => p.userId === ids[0])?.hasLeft).toBe(true);

    await service.leaveRoom(ids[2], code);
    view = (await service.getRoom(ids[1], code)) as SnlSnapshot;
    expect(view).toMatchObject({ status: "finished", endedReason: "player_left" });
  });

  it("starts quick-match games as soon as two players are paired", async () => {
    await pool.query("delete from public.game_rooms where is_public and status = 'waiting' and game_id = $1", [GAME]);
    const [a, b] = await Promise.all([createUser(), createUser()]);
    const first = await service.quickMatch(a, { gameId: GAME, displayName: "A" });
    expect(first.status).toBe("waiting");
    const second = await service.quickMatch(b, { gameId: GAME, displayName: "B" });
    expect(second.code).toBe(first.code);
    expect(second.status).toBe("playing");
  });
});
