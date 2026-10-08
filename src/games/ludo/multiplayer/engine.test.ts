import { describe, expect, it } from "vitest";
import { GameRuleError, type EngineContext } from "../../multiplayer/engine";
import { HOME, TURN_TIMEOUT_MS, YARD, type LudoOptions, type LudoState } from "../logic/types";
import { ludoEngine } from "./engine";

const players = [
  { userId: "ann", seat: 0 },
  { userId: "ben", seat: 1 },
];

function context(state: LudoState, overrides: Partial<EngineContext<LudoState, null, LudoOptions>> = {}) {
  // 0.4 rolls a 3; 0.99 rolls a 6.
  return { state, options: {}, players, secrets: {}, random: () => 0.4, now: 0, ...overrides };
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

const started = () => ludoEngine.start(players, {}, { random: () => 0, now: 1_000 }).state;
const withAnnOnBoard = (): LudoState => ({ ...started(), tokens: { ann: [5, 10, YARD, YARD], ben: [YARD, YARD, YARD, YARD] } });

describe("ludoEngine", () => {
  it("seats players in seat order", () => {
    const state = ludoEngine.start([players[1], players[0]], {}, { random: () => 0, now: 0 }).state;
    expect(state.order).toEqual(["ann", "ben"]);
  });

  it("rolls with the server's randomness, then lets the player pick a token", () => {
    const rolled = ludoEngine.applyAction(context(withAnnOnBoard()), "ann", { type: "roll", step: 0 }).state;
    expect(rolled).toMatchObject({ phase: "move", movable: [0, 1], step: 1 });
    expect(rolled.history[0]).toMatchObject({ playerId: "ann", value: 3, outcome: "choosing" });

    expect(ruleError(() => ludoEngine.applyAction(context(rolled), "ann", { type: "roll", step: 1 }))).toBe("CHOOSE_TOKEN");
    expect(ruleError(() => ludoEngine.applyAction(context(rolled), "ann", { type: "move", step: 1, token: 2 }))).toBe(
      "INVALID_MOVE",
    );
    const moved = ludoEngine.applyAction(context(rolled), "ann", { type: "move", step: 1, token: 1 });
    expect(moved.state.tokens.ann).toEqual([5, 13, YARD, YARD]);
    expect(moved.state.turn).toBe("ben");
    expect(moved.finished).toBe(false);
  });

  it("rejects actions out of turn, repeated actions, moves before rolling and outsiders", () => {
    const state = withAnnOnBoard();
    expect(ruleError(() => ludoEngine.applyAction(context(state), "ben", { type: "roll", step: 0 }))).toBe("NOT_YOUR_TURN");
    expect(ruleError(() => ludoEngine.applyAction(context(state), "ann", { type: "move", step: 0, token: 0 }))).toBe(
      "ROLL_FIRST",
    );
    const after = ludoEngine.applyAction(context(state), "ann", { type: "roll", step: 0 }).state;
    expect(ruleError(() => ludoEngine.applyAction(context(after), "ann", { type: "roll", step: 0 }))).toBe("STALE_TURN");
    expect(ruleError(() => ludoEngine.applyAction(context(state), "eve", { type: "roll", step: 0 }))).toBe("NOT_A_PLAYER");
  });

  it("plays for a player who runs out of time, but only once the time is up", () => {
    const state = withAnnOnBoard();
    const early = context(state, { now: state.turnStartedAt + TURN_TIMEOUT_MS - 1 });
    expect(ruleError(() => ludoEngine.applyAction(early, "ben", { type: "claim_timeout", step: 0 }))).toBe(
      "TURN_NOT_EXPIRED",
    );

    const late = context(state, { now: state.turnStartedAt + TURN_TIMEOUT_MS });
    const result = ludoEngine.applyAction(late, "ben", { type: "claim_timeout", step: 0 });
    // Ann's roll and move, made for her.
    expect(result.state.history[0]).toMatchObject({ playerId: "ann", outcome: "moved", auto: true });
    expect(result.state.turn).toBe("ben");
  });

  it("reports the end of the game and refuses further actions", () => {
    const nearlyWon: LudoState = { ...started(), tokens: { ann: [HOME, HOME, HOME, 53], ben: [YARD, YARD, YARD, YARD] } };
    const result = ludoEngine.applyAction(context(nearlyWon), "ann", { type: "roll", step: 0 });
    expect(result.finished).toBe(true);
    expect(result.state.winnerId).toBe("ann");
    expect(ruleError(() => ludoEngine.applyAction(context(result.state), "ben", { type: "roll", step: 2 }))).toBe(
      "MATCH_OVER",
    );
  });

  it.each([
    null,
    {},
    { type: "roll" },
    { type: "roll", step: -1 },
    { type: "move", step: 0 },
    { type: "move", step: 0, token: 4 },
    { type: "move", step: 0, token: "1" },
    { type: "fly", step: 0 },
  ])("rejects malformed action %j", (raw) => {
    expect(ruleError(() => ludoEngine.parseAction(raw))).toBe("INVALID_ACTION");
  });

  it("continues without a player who leaves", () => {
    const three = [...players, { userId: "cat", seat: 2 }];
    const state = ludoEngine.start(three, {}, { random: () => 0, now: 0 }).state;
    const result = ludoEngine.removePlayer!(context(state, { players: three.slice(1), now: 9 }), "ann");
    expect(result.state).toMatchObject({ order: ["ben", "cat"], turn: "ben", turnStartedAt: 9 });
  });
});
