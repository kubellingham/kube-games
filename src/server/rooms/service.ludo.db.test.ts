/**
 * Integration tests for Ludo rooms against a real Supabase Postgres: rolling,
 * picking tokens and timeouts. Run with `npm run test:db` (see service.db.test.ts).
 */
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LudoState } from "@/games/ludo/logic/types";
import type { RoomSnapshot } from "@/games/multiplayer/types";
import { getPool } from "../db";
import * as service from "./service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;

type LudoSnapshot = RoomSnapshot<LudoState, null>;
const GAME = "ludo";

describe.skipIf(!testDatabaseUrl)("Ludo rooms (database)", () => {
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

  /** A started two-player game; the host's tokens are on squares 5 and 10, so any roll needs a choice. */
  async function gameWithChoice() {
    const [host, guest] = await Promise.all([createUser(), createUser()]);
    const room = await service.createRoom(host, { gameId: GAME, displayName: "Host" });
    await service.joinRoom(guest, room.code, { displayName: "Guest" });
    await service.startGame(host, room.code);
    await pool.query(
      `update public.game_rooms set state = jsonb_set(state, array['tokens', $2::text], '[5, 10, -1, -1]'::jsonb) where code = $1`,
      [room.code, host],
    );
    return { host, guest, code: room.code };
  }

  const act = (userId: string, code: string, action: object) =>
    service.performAction(userId, code, action) as Promise<LudoSnapshot>;

  it("rolls on the server, then waits for the player to pick a token", async () => {
    const { host, guest, code } = await gameWithChoice();
    const rolled = await act(host, code, { type: "roll", step: 0 });
    const state = rolled.game!.state;
    expect(state).toMatchObject({ phase: "move", turn: host, step: 1 });
    expect(state.movable).toEqual(expect.arrayContaining([0, 1]));
    expect(state.history[0]).toMatchObject({ playerId: host, outcome: "choosing" });

    expect(await errorCode(act(guest, code, { type: "move", step: 1, token: 0 }))).toBe("NOT_YOUR_TURN");
    expect(await errorCode(act(host, code, { type: "roll", step: 1 }))).toBe("CHOOSE_TOKEN");

    // A double tap on a token moves it once.
    const results = await Promise.allSettled([
      act(host, code, { type: "move", step: 1, token: 0 }),
      act(host, code, { type: "move", step: 1, token: 0 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const view = (await service.getRoom(guest, code)) as LudoSnapshot;
    const value = state.history[0].value;
    expect(view.game!.state.tokens[host][0]).toBe(5 + value);
    expect(view.game!.state.history[0]).toMatchObject({ outcome: "moved", move: { token: 0, from: 5 } });
  });

  it("plays a pending pick for a player who runs out of time", async () => {
    const { host, guest, code } = await gameWithChoice();
    await act(host, code, { type: "roll", step: 0 });
    expect(await errorCode(act(guest, code, { type: "claim_timeout", step: 1 }))).toBe("TURN_NOT_EXPIRED");

    await pool.query(
      `update public.game_rooms set state = jsonb_set(state, '{turnStartedAt}', to_jsonb((extract(epoch from now()) * 1000 - 60000)::bigint)) where code = $1`,
      [code],
    );
    const claimed = await act(guest, code, { type: "claim_timeout", step: 1 });
    expect(claimed.game!.state.history[0]).toMatchObject({ playerId: host, outcome: "moved", auto: true });
  });
});
