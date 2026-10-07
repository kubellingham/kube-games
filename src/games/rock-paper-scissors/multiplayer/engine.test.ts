import { describe, expect, it } from "vitest";
import { GameRuleError, type EngineContext, type EngineResult } from "../../multiplayer/engine";
import { rpsEngine } from "./engine";
import type { RpsOptions, RpsSecret, RpsState } from "./types";

const players = [
  { userId: "alice", seat: 0 },
  { userId: "bob", seat: 1 },
];

type Context = EngineContext<RpsState, RpsSecret, RpsOptions>;

function startMatch(options: RpsOptions = { targetScore: 3 }): Context {
  const { state, secrets } = rpsEngine.start(players, options);
  return { state, options, players, secrets: secrets ?? {} };
}

function apply(context: Context, actorId: string, raw: unknown): Context & { result: EngineResult<RpsState, RpsSecret> } {
  const result = rpsEngine.applyAction(context, actorId, rpsEngine.parseAction(raw));
  return {
    ...context,
    state: result.state,
    secrets: { ...context.secrets, ...result.secrets },
    result,
  };
}

function expectRuleError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(GameRuleError);
    expect((error as GameRuleError).code).toBe(code);
    return;
  }
  throw new Error(`Expected GameRuleError ${code}`);
}

describe("rpsEngine", () => {
  it("starts at round 1 with zero scores", () => {
    const { state } = startMatch();
    expect(state).toEqual({
      round: 1,
      scores: { alice: 0, bob: 0 },
      draws: 0,
      lockedIn: [],
      history: [],
      matchWinnerId: null,
    });
  });

  it("keeps the first move secret until both players have locked in", () => {
    const afterAlice = apply(startMatch(), "alice", { type: "submit_move", round: 1, move: "rock" });

    expect(afterAlice.state.lockedIn).toEqual(["alice"]);
    expect(afterAlice.result.secrets).toEqual({ alice: { round: 1, move: "rock" } });
    // Nothing in the public state reveals what Alice played.
    expect(JSON.stringify(afterAlice.state)).not.toContain("rock");
    expect(afterAlice.state.history).toEqual([]);
  });

  it("reveals both moves, scores the winner and advances the round", () => {
    let ctx = apply(startMatch(), "alice", { type: "submit_move", round: 1, move: "rock" });
    ctx = apply(ctx, "bob", { type: "submit_move", round: 1, move: "scissors" });

    expect(ctx.state.round).toBe(2);
    expect(ctx.state.scores).toEqual({ alice: 1, bob: 0 });
    expect(ctx.state.lockedIn).toEqual([]);
    expect(ctx.state.history[0]).toEqual({
      round: 1,
      moves: { alice: "rock", bob: "scissors" },
      winnerId: "alice",
    });
    expect(ctx.result.secrets).toEqual({ alice: null, bob: null });
    expect(ctx.result.finished).toBe(false);
  });

  it("resolves the same way whichever player submits last", () => {
    let ctx = apply(startMatch(), "bob", { type: "submit_move", round: 1, move: "paper" });
    ctx = apply(ctx, "alice", { type: "submit_move", round: 1, move: "scissors" });
    expect(ctx.state.history[0].winnerId).toBe("alice");
    expect(ctx.state.scores).toEqual({ alice: 1, bob: 0 });
  });

  it("counts draws without changing scores", () => {
    let ctx = apply(startMatch(), "alice", { type: "submit_move", round: 1, move: "paper" });
    ctx = apply(ctx, "bob", { type: "submit_move", round: 1, move: "paper" });
    expect(ctx.state.draws).toBe(1);
    expect(ctx.state.scores).toEqual({ alice: 0, bob: 0 });
    expect(ctx.state.history[0].winnerId).toBeNull();
  });

  it("rejects a second move in the same round", () => {
    const ctx = apply(startMatch(), "alice", { type: "submit_move", round: 1, move: "rock" });
    expectRuleError(
      () => apply(ctx, "alice", { type: "submit_move", round: 1, move: "paper" }),
      "ALREADY_SUBMITTED",
    );
  });

  it("rejects moves for a round that is not the current one", () => {
    expectRuleError(
      () => apply(startMatch(), "alice", { type: "submit_move", round: 2, move: "rock" }),
      "ROUND_MISMATCH",
    );
  });

  it("rejects players who are not seated", () => {
    expectRuleError(
      () => apply(startMatch(), "mallory", { type: "submit_move", round: 1, move: "rock" }),
      "NOT_A_PLAYER",
    );
  });

  it.each([
    null,
    "rock",
    { type: "submit_move", round: 1, move: "lizard" },
    { type: "submit_move", round: 0, move: "rock" },
    { type: "submit_move", round: "1", move: "rock" },
    { type: "something_else", round: 1, move: "rock" },
  ])("rejects malformed action %j", (raw) => {
    expectRuleError(() => rpsEngine.parseAction(raw), "INVALID_ACTION");
  });

  it("ends the match when a player reaches the target score", () => {
    let ctx = startMatch({ targetScore: 3 });
    let finished: boolean | undefined;
    for (let round = 1; round <= 3; round++) {
      ctx = apply(ctx, "alice", { type: "submit_move", round, move: "rock" });
      const afterBob = apply(ctx, "bob", { type: "submit_move", round, move: "scissors" });
      finished = afterBob.result.finished;
      ctx = afterBob;
    }
    expect(ctx.state.matchWinnerId).toBe("alice");
    expect(finished).toBe(true);
    expectRuleError(() => apply(ctx, "bob", { type: "submit_move", round: 4, move: "rock" }), "MATCH_OVER");
  });

  it("never ends an endless match", () => {
    let ctx = startMatch({ targetScore: null });
    for (let round = 1; round <= 12; round++) {
      ctx = apply(ctx, "alice", { type: "submit_move", round, move: "rock" });
      ctx = apply(ctx, "bob", { type: "submit_move", round, move: "scissors" });
    }
    expect(ctx.state.matchWinnerId).toBeNull();
    expect(ctx.state.scores.alice).toBe(12);
    expect(ctx.state.history).toHaveLength(10);
    expect(ctx.state.history[0].round).toBe(12);
  });

  it("validates room options", () => {
    expect(rpsEngine.parseOptions(undefined)).toEqual({ targetScore: 3 });
    expect(rpsEngine.parseOptions({ targetScore: 5 })).toEqual({ targetScore: 5 });
    expect(rpsEngine.parseOptions({ targetScore: null })).toEqual({ targetScore: null });
    expectRuleError(() => rpsEngine.parseOptions({ targetScore: 1000 }), "INVALID_OPTIONS");
    expectRuleError(() => rpsEngine.parseOptions("first to 3"), "INVALID_OPTIONS");
  });
});
