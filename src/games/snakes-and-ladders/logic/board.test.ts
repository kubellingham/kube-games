import { describe, expect, it } from "vitest";
import { FINAL_SQUARE, LADDERS, SNAKES, jumpFrom, squareToCell } from "./board";

describe("classic board", () => {
  const ladders = Object.entries(LADDERS).map(([from, to]) => [Number(from), to]);
  const snakes = Object.entries(SNAKES).map(([from, to]) => [Number(from), to]);

  it("has ladders that go up and snakes that go down, all on the board", () => {
    for (const [from, to] of ladders) {
      expect(to).toBeGreaterThan(from);
      expect(from).toBeGreaterThanOrEqual(1);
      expect(to).toBeLessThanOrEqual(FINAL_SQUARE);
    }
    for (const [from, to] of snakes) {
      expect(to).toBeLessThan(from);
      expect(from).toBeLessThan(FINAL_SQUARE);
      expect(to).toBeGreaterThanOrEqual(1);
    }
  });

  it("never chains jumps or puts two on one square", () => {
    const starts = [...ladders, ...snakes].map(([from]) => from);
    expect(new Set(starts).size).toBe(starts.length);
    for (const [, to] of [...ladders, ...snakes]) {
      expect(jumpFrom(to)).toBeNull();
    }
  });

  it("describes jumps", () => {
    expect(jumpFrom(28)).toEqual({ to: 84, via: "ladder" });
    expect(jumpFrom(98)).toEqual({ to: 78, via: "snake" });
    expect(jumpFrom(50)).toBeNull();
  });
});

describe("squareToCell", () => {
  it("numbers the board back and forth from the bottom-left", () => {
    expect(squareToCell(1)).toEqual({ row: 9, col: 0 });
    expect(squareToCell(10)).toEqual({ row: 9, col: 9 });
    expect(squareToCell(11)).toEqual({ row: 8, col: 9 });
    expect(squareToCell(20)).toEqual({ row: 8, col: 0 });
    expect(squareToCell(21)).toEqual({ row: 7, col: 0 });
    expect(squareToCell(100)).toEqual({ row: 0, col: 0 });
  });

  it("puts every square in its own cell", () => {
    const cells = new Set(Array.from({ length: 100 }, (_, i) => JSON.stringify(squareToCell(i + 1))));
    expect(cells.size).toBe(100);
  });
});
