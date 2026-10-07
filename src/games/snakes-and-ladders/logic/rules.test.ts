import { describe, expect, it } from "vitest";
import { dieValue, newGame, playRoll, withoutPlayer } from "./rules";
import type { SnlState } from "./types";

const at = (state: SnlState, positions: Record<string, number>): SnlState => ({
  ...state,
  positions: { ...state.positions, ...positions },
});

describe("dieValue", () => {
  it("maps the random range evenly onto 1–6", () => {
    expect(dieValue(() => 0)).toBe(1);
    expect(dieValue(() => 0.17)).toBe(2);
    expect(dieValue(() => 0.5)).toBe(4);
    expect(dieValue(() => 0.9999)).toBe(6);
  });
});

describe("playRoll", () => {
  const start = newGame(["ann", "ben", "cat"], 1000);

  it("starts everyone off the board with the first player to roll", () => {
    expect(start).toMatchObject({ turn: "ann", positions: { ann: 0, ben: 0, cat: 0 }, rollCount: 0 });
  });

  it("moves by the roll and passes the turn", () => {
    const next = playRoll(start, 3, 2000);
    expect(next.positions.ann).toBe(3);
    expect(next.turn).toBe("ben");
    expect(next.turnStartedAt).toBe(2000);
    expect(next.history[0]).toMatchObject({ seq: 1, playerId: "ann", value: 3, from: 0, landed: 3, to: 3, outcome: "moved" });
  });

  it("climbs ladders and slides down snakes", () => {
    const climb = playRoll(at(start, { ann: 24 }), 4, 0);
    expect(climb.positions.ann).toBe(84);
    expect(climb.history[0]).toMatchObject({ landed: 28, to: 84, via: "ladder" });

    const slide = playRoll(at(start, { ann: 94 }), 4, 0);
    expect(slide.positions.ann).toBe(78);
    expect(slide.history[0]).toMatchObject({ landed: 98, to: 78, via: "snake" });
  });

  it("gives another roll after a 6, and forfeits the third 6 in a row", () => {
    // 2 → 8 → 14 has no snakes or ladders on the way.
    let state = playRoll(at(start, { ann: 2 }), 6, 0);
    expect(state).toMatchObject({ turn: "ann", sixStreak: 1 });
    state = playRoll(state, 6, 0);
    expect(state).toMatchObject({ turn: "ann", sixStreak: 2 });
    expect(state.positions.ann).toBe(14);
    state = playRoll(state, 6, 0);
    expect(state.positions.ann).toBe(14);
    expect(state).toMatchObject({ turn: "ben", sixStreak: 0 });
    expect(state.history[0]).toMatchObject({ outcome: "third-six", from: 14, to: 14, extraTurn: false });
  });

  it("resets the 6 streak when a different number comes up", () => {
    let state = playRoll(at(start, { ann: 2 }), 6, 0);
    state = playRoll(state, 2, 0);
    expect(state).toMatchObject({ turn: "ben", sixStreak: 0 });
  });

  it("needs an exact roll to finish, staying put on an overshoot", () => {
    const over = playRoll(at(start, { ann: 97 }), 5, 0);
    expect(over.positions.ann).toBe(97);
    expect(over.turn).toBe("ben");
    expect(over.history[0]).toMatchObject({ outcome: "overshoot", from: 97, to: 97 });

    const won = playRoll(at(start, { ann: 97 }), 3, 0);
    expect(won.winnerId).toBe("ann");
    expect(won.history[0]).toMatchObject({ outcome: "won", to: 100, extraTurn: false });
  });

  it("wins by climbing the ladder on 80", () => {
    const won = playRoll(at(start, { ann: 76 }), 4, 0);
    expect(won.winnerId).toBe("ann");
    expect(won.history[0]).toMatchObject({ landed: 80, to: 100, via: "ladder", outcome: "won" });
  });

  it("keeps a short history, newest first", () => {
    let state = start;
    for (let i = 0; i < 20; i++) state = playRoll(state, 1, 0);
    expect(state.history).toHaveLength(12);
    expect(state.history[0].seq).toBe(20);
    expect(state.rollCount).toBe(20);
  });
});

describe("withoutPlayer", () => {
  const start = newGame(["ann", "ben", "cat"], 0);

  it("passes the turn on when the current player leaves", () => {
    const next = withoutPlayer(start, "ann", 5000);
    expect(next.order).toEqual(["ben", "cat"]);
    expect(next.turn).toBe("ben");
    expect(next.turnStartedAt).toBe(5000);
    expect(next.positions).not.toHaveProperty("ann");
  });

  it("keeps the turn when someone else leaves, and wraps around the order", () => {
    expect(withoutPlayer(start, "cat", 0).turn).toBe("ann");
    const catsTurn = { ...start, turn: "cat" };
    expect(withoutPlayer(catsTurn, "cat", 0).turn).toBe("ann");
  });
});
