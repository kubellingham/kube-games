import { describe, expect, it } from "vitest";
import { describeRoll } from "./describe-roll";
import type { SnlRoll } from "./types";

const roll = (overrides: Partial<SnlRoll>): SnlRoll => ({
  seq: 1,
  playerId: "ann",
  value: 4,
  from: 10,
  landed: 14,
  to: 14,
  via: null,
  outcome: "moved",
  extraTurn: false,
  auto: false,
  ...overrides,
});

describe("describeRoll", () => {
  it("describes ordinary moves, ladders and snakes", () => {
    expect(describeRoll(roll({}), "Ann", false)).toBe("Ann rolled 4 and moved to 14.");
    expect(describeRoll(roll({ via: "ladder", to: 84 }), "Ann", true)).toBe("You rolled 4 and climbed a ladder to 84! 🪜");
    expect(describeRoll(roll({ via: "snake", to: 6 }), "Ann", false)).toBe("Ann rolled 4 and slid down a snake to 6. 🐍");
  });

  it("explains overshoots, third sixes, wins and extra turns", () => {
    expect(describeRoll(roll({ from: 97, value: 5, outcome: "overshoot" }), "Ann", true)).toBe(
      "You rolled 5 but need exactly 3 to finish.",
    );
    expect(describeRoll(roll({ value: 6, outcome: "third-six" }), "Ann", false)).toBe(
      "Ann rolled 6: a third 6 in a row, so the turn is over.",
    );
    expect(describeRoll(roll({ outcome: "won", to: 100 }), "Ann", false)).toBe("Ann rolled 4 and reached 100! 🏆");
    expect(describeRoll(roll({ value: 6, extraTurn: true, to: 16 }), "Ann", false)).toBe(
      "Ann rolled 6 and moved to 16. Ann rolls again!",
    );
  });

  it("says when the game rolled for an absent player", () => {
    expect(describeRoll(roll({ auto: true }), "Ann", false)).toBe(
      "Out of time, so the game rolled for Ann. Ann rolled 4 and moved to 14.",
    );
  });
});
