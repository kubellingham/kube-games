import { describe, expect, it } from "vitest";
import { chooseMove } from "./ai";
import { describeRoll } from "./describe-roll";
import { applyMove, applyRoll, newGame, playForAbsentPlayer, withoutPlayer } from "./rules";
import { HOME, YARD, type LudoState, type TokenStep } from "./types";

const withTokens = (state: LudoState, tokens: Record<string, TokenStep[]>): LudoState => ({
  ...state,
  tokens: { ...state.tokens, ...tokens },
});

const two = newGame(["ann", "ben"], 1000);
const out = [YARD, YARD, YARD];

describe("newGame", () => {
  it("puts every token in its yard, with two players in opposite corners", () => {
    expect(two).toMatchObject({
      colors: { ann: 0, ben: 2 },
      tokens: { ann: [YARD, YARD, YARD, YARD], ben: [YARD, YARD, YARD, YARD] },
      turn: "ann",
      phase: "roll",
      step: 0,
    });
  });
});

describe("applyRoll and applyMove", () => {
  it("needs a 6 to bring a token out", () => {
    const next = applyRoll(two, 4, 2000);
    expect(next.history[0]).toMatchObject({ seq: 1, playerId: "ann", value: 4, outcome: "no-move", extraTurn: false });
    expect(next).toMatchObject({ turn: "ben", phase: "roll", step: 1, turnStartedAt: 2000 });
  });

  it("brings a token out on a 6 and rolls again, without asking when every choice is the same", () => {
    const next = applyRoll(two, 6, 0);
    expect(next.tokens.ann).toEqual([0, YARD, YARD, YARD]);
    expect(next.history[0]).toMatchObject({
      outcome: "moved",
      move: { token: 0, from: YARD, to: 0, captured: [] },
      extraTurn: true,
    });
    expect(next).toMatchObject({ turn: "ann", phase: "roll", sixStreak: 1 });
  });

  it("asks the player to pick a token when moves differ", () => {
    const rolled = applyRoll(withTokens(two, { ann: [5, 10, YARD, YARD] }), 3, 0);
    expect(rolled).toMatchObject({ phase: "move", movable: [0, 1], turn: "ann" });
    expect(rolled.history[0].outcome).toBe("choosing");

    const moved = applyMove(rolled, 1, 500);
    expect(moved.tokens.ann).toEqual([5, 13, YARD, YARD]);
    expect(moved).toMatchObject({ phase: "roll", movable: [], turn: "ben", turnStartedAt: 500, step: rolled.step + 1 });
    expect(moved.history[0]).toMatchObject({ seq: 1, outcome: "moved", move: { token: 1, from: 10, to: 13 } });
  });

  it("captures an opponent on an ordinary square, sending it home, and rolls again", () => {
    // Red's step 14 and yellow's step 40 are the same square.
    const next = applyRoll(withTokens(two, { ann: [11, ...out], ben: [40, ...out] }), 3, 0);
    expect(next.tokens.ann[0]).toBe(14);
    expect(next.tokens.ben[0]).toBe(YARD);
    expect(next.history[0].move?.captured).toEqual([{ playerId: "ben", token: 0, from: 40 }]);
    expect(next).toMatchObject({ turn: "ann", phase: "roll" });
  });

  it("never captures on stars or start squares", () => {
    const star = applyRoll(withTokens(two, { ann: [5, ...out], ben: [34, ...out] }), 3, 0);
    expect(star.tokens).toMatchObject({ ann: [8, ...out], ben: [34, ...out] });
    expect(star.turn).toBe("ben");

    const start = applyRoll(withTokens(two, { ann: [23, ...out], ben: [0, ...out] }), 3, 0);
    expect(start.tokens).toMatchObject({ ann: [26, ...out], ben: [0, ...out] });
  });

  it("needs an exact roll to get home, and getting home earns another roll", () => {
    // 53 + 4 overshoots, so only the other token can move, and does so automatically.
    let state = applyRoll(withTokens(two, { ann: [53, 10, YARD, YARD] }), 4, 0);
    expect(state.tokens.ann).toEqual([53, 14, YARD, YARD]);

    state = applyRoll({ ...state, turn: "ann" }, 3, 0);
    state = applyMove(state, 0, 0);
    expect(state.tokens.ann[0]).toBe(HOME);
    expect(state.history[0]).toMatchObject({ extraTurn: true });
    expect(state.turn).toBe("ann");
  });

  it("rolls again after a 6 even when nothing can move, but a third 6 ends the turn", () => {
    const stuck = applyRoll(withTokens(two, { ann: [HOME, HOME, HOME, 53] }), 6, 0);
    expect(stuck.history[0]).toMatchObject({ outcome: "no-move", extraTurn: true });
    expect(stuck).toMatchObject({ turn: "ann", sixStreak: 1 });

    const third = applyRoll({ ...withTokens(two, { ann: [10, ...out] }), sixStreak: 2 }, 6, 0);
    expect(third.history[0]).toMatchObject({ outcome: "third-six", extraTurn: false });
    expect(third.tokens.ann).toEqual([10, ...out]);
    expect(third).toMatchObject({ turn: "ben", sixStreak: 0 });
  });

  it("wins when the last token gets home", () => {
    const next = applyRoll(withTokens(two, { ann: [HOME, HOME, HOME, 54] }), 2, 0);
    expect(next.winnerId).toBe("ann");
    expect(next.history[0]).toMatchObject({ outcome: "moved", extraTurn: false });
  });
});

describe("playForAbsentPlayer", () => {
  it("rolls and moves for a player who ran out of time", () => {
    const next = playForAbsentPlayer(withTokens(two, { ann: [5, 10, YARD, YARD] }), () => 0.4, 0, chooseMove);
    expect(next.history[0]).toMatchObject({ playerId: "ann", value: 3, outcome: "moved", auto: true });
    expect(next.turn).toBe("ben");
  });

  it("only moves if the player already rolled", () => {
    const rolled = applyRoll(withTokens(two, { ann: [5, 10, YARD, YARD] }), 3, 0);
    const next = playForAbsentPlayer(rolled, () => 0.99, 0, () => 0);
    expect(next.tokens.ann).toEqual([8, 10, YARD, YARD]);
    expect(next.history[0]).toMatchObject({ value: 3, auto: true });
  });
});

describe("withoutPlayer", () => {
  const three = newGame(["ann", "ben", "cat"], 0);

  it("takes a leaver's tokens off the board and moves the turn on", () => {
    const choosing = applyRoll(withTokens(three, { ann: [5, 10, YARD, YARD] }), 3, 0);
    const next = withoutPlayer(choosing, "ann", 50);
    expect(next.order).toEqual(["ben", "cat"]);
    expect(next.tokens).not.toHaveProperty("ann");
    expect(next).toMatchObject({ turn: "ben", phase: "roll", movable: [], turnStartedAt: 50 });
    expect(next.history[0].outcome).toBe("left");
    expect(next.step).toBe(choosing.step + 1);
  });

  it("leaves the turn alone when someone else leaves", () => {
    const next = withoutPlayer(three, "cat", 50);
    expect(next).toMatchObject({ order: ["ann", "ben"], turn: "ann", step: 0 });
  });
});

describe("chooseMove", () => {
  it("captures when it can", () => {
    const state = applyRoll(withTokens(two, { ann: [11, 30, YARD, YARD], ben: [40, ...out] }), 3, 0);
    expect(chooseMove(state)).toBe(0);
  });

  it("brings a token out rather than taking a small step", () => {
    const state = applyRoll(withTokens(two, { ann: [20, YARD, YARD, YARD] }), 6, 0);
    expect(chooseMove(state)).toBe(1);
  });

  it("avoids stopping just ahead of an opponent", () => {
    // Yellow's step 43 is red's square 17: it threatens squares 18–23.
    const state = applyRoll(withTokens(two, { ann: [10, 20, YARD, YARD], ben: [43, ...out] }), 2, 0);
    expect(chooseMove(state)).toBe(0);
  });
});

describe("describeRoll", () => {
  const names: Record<string, string> = { ann: "Ann", ben: "Ben" };
  const nameOf = (id: string) => names[id];

  it("describes captures, homecomings and timeouts from each viewer's side", () => {
    const capture = applyRoll(withTokens(two, { ann: [11, ...out], ben: [40, ...out] }), 3, 0).history[0];
    expect(describeRoll(capture, nameOf, "ben")).toBe("Ann rolled 3 and captured your token! Ann rolls again!");
    expect(describeRoll(capture, nameOf, "ann")).toBe("You rolled 3 and captured Ben's token! Roll again!");

    const home = applyRoll(withTokens(two, { ann: [53, ...out] }), 3, 0).history[0];
    expect(describeRoll(home, nameOf, "ann")).toBe("You rolled 3 and got a token home! 🏠 Roll again!");

    const auto = playForAbsentPlayer(two, () => 0, 0, chooseMove).history[0];
    expect(describeRoll(auto, nameOf, "ben")).toBe("Out of time, so the game played for Ann. Ann rolled 1 but no token can move.");
  });

  it("describes a pending choice", () => {
    const choosing = applyRoll(withTokens(two, { ann: [5, 10, YARD, YARD] }), 3, 0).history[0];
    expect(describeRoll(choosing, nameOf, "ann")).toBe("You rolled 3. Pick a token to move.");
    expect(describeRoll(choosing, nameOf, "ben")).toBe("Ann rolled 3 and is choosing a token…");
  });
});
