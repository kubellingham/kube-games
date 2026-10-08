import { describe, expect, it } from "vitest";
import { GameRuleError, type EngineContext } from "../../multiplayer/engine";
import { drawBoard } from "../logic/test-helpers";
import type { C4Options, C4State } from "../logic/types";
import { c4Engine } from "./engine";

const players = [
  { userId: "ann", seat: 0 },
  { userId: "ben", seat: 1 },
];

type Context = EngineContext<C4State, null, C4Options>;

function context(state: C4State, overrides: Partial<Context> = {}): Context {
  return { state, options: {}, players, secrets: {}, random: () => 0, now: 0, ...overrides };
}

function ruleError(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(GameRuleError);
    return (error as GameRuleError).code;
  }
  throw new Error("Expected a GameRuleError");
}

/** Ann (Red) moves first. */
const started = () => c4Engine.start(players, {}, { random: () => 0.2, now: 0 }).state;

function play(state: C4State, actorId: string, column: number) {
  return c4Engine.applyAction(context(state), actorId, c4Engine.parseAction({ type: "drop", column, seq: state.moveCount }));
}

describe("c4Engine", () => {
  it("seats Red then Yellow by seat, and tosses a coin for who goes first", () => {
    const reversed = [players[1], players[0]];
    const annFirst = c4Engine.start(reversed, {}, { random: () => 0.49, now: 0 }).state;
    expect(annFirst).toMatchObject({ players: ["ann", "ben"], turn: "ann", firstPlayerId: "ann", moveCount: 0 });

    const benFirst = c4Engine.start(players, {}, { random: () => 0.5, now: 0 }).state;
    expect(benFirst).toMatchObject({ players: ["ann", "ben"], turn: "ben", firstPlayerId: "ben" });
    expect(benFirst).toMatchObject({ lastMove: null, winnerId: null, draw: false, winningCells: [] });
  });

  it("keeps the state plain JSON", () => {
    const state = play(started(), "ann", 3).state;
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("drops the disc for the player whose turn it is and passes the turn", () => {
    const result = play(started(), "ann", 3);
    expect(result.finished).toBe(false);
    expect(result.state.board[5][3]).toBe("red");
    expect(result.state).toMatchObject({ turn: "ben", moveCount: 1, lastMove: { row: 5, column: 3, playerId: "ann" } });

    const reply = play(result.state, "ben", 3);
    expect(reply.state.board[4][3]).toBe("yellow");
    expect(reply.state.turn).toBe("ann");
  });

  it("rejects moves out of turn, repeated moves and outsiders", () => {
    const state = started();
    expect(ruleError(() => play(state, "ben", 0))).toBe("NOT_YOUR_TURN");
    expect(ruleError(() => play(state, "eve", 0))).toBe("NOT_A_PLAYER");

    const after = play(state, "ann", 0).state;
    // Ann's double tap arrives with the move count she saw before her first drop.
    expect(ruleError(() => c4Engine.applyAction(context(after), "ann", { type: "drop", column: 0, seq: 0 }))).toBe(
      "STALE_MOVE",
    );
    expect(ruleError(() => c4Engine.applyAction(context(after), "ben", { type: "drop", column: 0, seq: 0 }))).toBe(
      "STALE_MOVE",
    );
  });

  it("rejects a full column", () => {
    const state = { ...started(), board: drawBoard("Y......", "R......", "Y......", "R......", "Y......", "R......") };
    expect(ruleError(() => play(state, "ann", 0))).toBe("COLUMN_FULL");
    expect(play(state, "ann", 1).state.board[5][1]).toBe("red");
  });

  it("finishes with the winner and the winning line, then refuses further moves", () => {
    let state = started();
    for (const [actor, column] of [["ann", 0], ["ben", 6], ["ann", 1], ["ben", 6], ["ann", 2], ["ben", 6]] as const) {
      state = play(state, actor, column).state;
    }
    const result = play(state, "ann", 3);
    expect(result.finished).toBe(true);
    expect(result.state).toMatchObject({ winnerId: "ann", draw: false, moveCount: 7 });
    expect(result.state.winningCells).toEqual([0, 1, 2, 3].map((column) => ({ row: 5, column })));
    expect(ruleError(() => play(result.state, "ben", 6))).toBe("MATCH_OVER");
  });

  it("finishes as a draw when the board fills up", () => {
    const board = drawBoard(".RYYRRY", "YYRRYYR", "RRYYRRY", "YYRRYYR", "RRYYRRY", "YYRRYYR");
    const result = play({ ...started(), board, moveCount: 41 }, "ann", 0);
    expect(result.finished).toBe(true);
    expect(result.state).toMatchObject({ draw: true, winnerId: null, moveCount: 42 });
  });

  it.each([
    null,
    "drop",
    [],
    {},
    { type: "drop", column: 3 },
    { type: "drop", seq: 0 },
    { type: "drop", column: 7, seq: 0 },
    { type: "drop", column: -1, seq: 0 },
    { type: "drop", column: 2.5, seq: 0 },
    { type: "drop", column: "3", seq: 0 },
    { type: "drop", column: 3, seq: -1 },
    { type: "drop", column: 3, seq: 42 },
    { type: "drop", column: 3, seq: "0" },
    { type: "pop", column: 3, seq: 0 },
  ])("rejects malformed action %j", (raw) => {
    expect(ruleError(() => c4Engine.parseAction(raw))).toBe("INVALID_ACTION");
  });

  it("keeps only the fields it knows from an action, and has no options", () => {
    expect(c4Engine.parseAction({ type: "drop", column: 6, seq: 41, extra: true })).toEqual({ type: "drop", column: 6, seq: 41 });
    expect(c4Engine.parseOptions(undefined)).toEqual({});
    expect(c4Engine.parseOptions({ anything: 1 })).toEqual({});
  });
});
