import { describe, expect, it } from "vitest";
import { GameRuleError, type EngineContext } from "../../multiplayer/engine";
import { TURN_TIMEOUT_MS, type SnlOptions, type SnlState } from "../logic/types";
import { snlEngine } from "./engine";

const players = [
  { userId: "ann", seat: 0 },
  { userId: "ben", seat: 1 },
];

function context(state: SnlState, overrides: Partial<EngineContext<SnlState, null, SnlOptions>> = {}) {
  // 0.4 rolls a 3.
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

const started = () => snlEngine.start(players, {}, { random: () => 0, now: 1_000 }).state;

describe("snlEngine", () => {
  it("rolls with the server's randomness for the player whose turn it is", () => {
    const result = snlEngine.applyAction(context(started()), "ann", { type: "roll", seq: 0 });
    expect(result.state.history[0]).toMatchObject({ playerId: "ann", value: 3, to: 3, auto: false });
    expect(result.finished).toBe(false);
  });

  it("rejects rolls out of turn, repeated rolls and outsiders", () => {
    const state = started();
    expect(ruleError(() => snlEngine.applyAction(context(state), "ben", { type: "roll", seq: 0 }))).toBe("NOT_YOUR_TURN");
    const after = snlEngine.applyAction(context(state), "ann", { type: "roll", seq: 0 }).state;
    expect(ruleError(() => snlEngine.applyAction(context(after), "ann", { type: "roll", seq: 0 }))).toBe("STALE_TURN");
    expect(ruleError(() => snlEngine.applyAction(context(state), "eve", { type: "roll", seq: 0 }))).toBe("NOT_A_PLAYER");
  });

  it("lets any player trigger the auto-roll only once the turn has timed out", () => {
    const state = started();
    const early = context(state, { now: state.turnStartedAt + TURN_TIMEOUT_MS - 1 });
    expect(ruleError(() => snlEngine.applyAction(early, "ben", { type: "claim_timeout", seq: 0 }))).toBe(
      "TURN_NOT_EXPIRED",
    );

    const late = context(state, { now: state.turnStartedAt + TURN_TIMEOUT_MS });
    const result = snlEngine.applyAction(late, "ben", { type: "claim_timeout", seq: 0 });
    // The roll is still Ann's; the game just made it for her.
    expect(result.state.history[0]).toMatchObject({ playerId: "ann", auto: true });
    expect(result.state.turn).toBe("ben");
  });

  it("reports the end of the game and refuses further rolls", () => {
    const nearlyWon = { ...started(), positions: { ann: 97, ben: 0 } };
    const result = snlEngine.applyAction(context(nearlyWon), "ann", { type: "roll", seq: 0 });
    expect(result.finished).toBe(true);
    expect(result.state.winnerId).toBe("ann");
    expect(ruleError(() => snlEngine.applyAction(context(result.state), "ben", { type: "roll", seq: 1 }))).toBe(
      "MATCH_OVER",
    );
  });

  it.each([null, {}, { type: "roll" }, { type: "roll", seq: -1 }, { type: "roll", seq: "0" }, { type: "fly", seq: 0 }])(
    "rejects malformed action %j",
    (raw) => {
      expect(ruleError(() => snlEngine.parseAction(raw))).toBe("INVALID_ACTION");
    },
  );

  it("continues without a player who leaves", () => {
    const three = [...players, { userId: "cat", seat: 2 }];
    const state = snlEngine.start(three, {}, { random: () => 0, now: 0 }).state;
    const result = snlEngine.removePlayer!(context(state, { players: three.slice(1), now: 9 }), "ann");
    expect(result.state).toMatchObject({ order: ["ben", "cat"], turn: "ben", turnStartedAt: 9 });
  });
});
