import { describe, expect, it } from "vitest";
import { RPS_MOVES } from "./moves";
import { describeRound, getOutcome, randomMove } from "./rules";

describe("getOutcome", () => {
  it("rock beats scissors", () => {
    expect(getOutcome("rock", "scissors")).toBe("win");
    expect(getOutcome("scissors", "rock")).toBe("lose");
  });

  it("scissors beats paper", () => {
    expect(getOutcome("scissors", "paper")).toBe("win");
    expect(getOutcome("paper", "scissors")).toBe("lose");
  });

  it("paper beats rock", () => {
    expect(getOutcome("paper", "rock")).toBe("win");
    expect(getOutcome("rock", "paper")).toBe("lose");
  });

  it.each(RPS_MOVES)("%s against itself is a draw", (move) => {
    expect(getOutcome(move, move)).toBe("draw");
  });

  it("is symmetric for every pairing", () => {
    const opposite = { win: "lose", lose: "win", draw: "draw" } as const;
    for (const a of RPS_MOVES) {
      for (const b of RPS_MOVES) {
        expect(getOutcome(b, a)).toBe(opposite[getOutcome(a, b)]);
      }
    }
  });
});

describe("describeRound", () => {
  it("names the winning move first regardless of argument order", () => {
    expect(describeRound("rock", "paper")).toBe("Paper covers Rock");
    expect(describeRound("paper", "rock")).toBe("Paper covers Rock");
    expect(describeRound("scissors", "paper")).toBe("Scissors cut Paper");
  });

  it("describes draws", () => {
    expect(describeRound("rock", "rock")).toBe("Both played Rock");
  });
});

describe("randomMove", () => {
  it("maps the random range evenly onto the three moves", () => {
    expect(randomMove(() => 0)).toBe("rock");
    expect(randomMove(() => 0.34)).toBe("paper");
    expect(randomMove(() => 0.99)).toBe("scissors");
  });

  it("produces every move with the default secure source", () => {
    const seen = new Set(Array.from({ length: 300 }, () => randomMove()));
    expect(seen).toEqual(new Set(RPS_MOVES));
  });
});
