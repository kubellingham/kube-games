import { describe, expect, it } from "vitest";
import { chooseComputerMove, DIFFICULTIES, type Difficulty } from "./ai";
import { emptyBoard, legalColumns } from "./board";
import { newGame, playDrop } from "./rules";
import { drawBoard } from "./test-helpers";

/** A small seeded generator (mulberry32), so every run sees the same "random" choices. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const SEARCHING: Difficulty[] = ["medium", "hard"];

describe("chooseComputerMove", () => {
  it.each(SEARCHING)("%s always takes an immediate win", (difficulty) => {
    const board = drawBoard("R......", "RRRYYY.");
    for (const seed of SEEDS) expect(chooseComputerMove(board, "yellow", difficulty, seeded(seed))).toBe(6);
  });

  it("easy takes an immediate win when it notices it, and sometimes misses it", () => {
    const board = drawBoard("YY.....", "RRR.YY.");
    expect(chooseComputerMove(board, "red", "easy", () => 0.1)).toBe(3);
    expect(chooseComputerMove(board, "red", "easy", () => 0.99)).not.toBe(3);
  });

  it.each(SEARCHING)("%s blocks the opponent's immediate win", (difficulty) => {
    // Across: red has three on the bottom row.
    const across = drawBoard("Y......", "YRRR...");
    // Upwards: red has three stacked in column 2.
    const upwards = drawBoard("..R....", "..R....", "..R.YY.");
    // Diagonally: yellow is one disc away from a rising diagonal; red must block it.
    const diagonal = drawBoard("..YR...", ".YRR...", "YRRY..Y");
    for (const seed of SEEDS) {
      expect(chooseComputerMove(across, "yellow", difficulty, seeded(seed))).toBe(4);
      expect(chooseComputerMove(upwards, "yellow", difficulty, seeded(seed))).toBe(2);
      expect(chooseComputerMove(diagonal, "red", difficulty, seeded(seed))).toBe(3);
    }
  });

  it.each(SEARCHING)("%s doesn't hand the opponent a winning space", (difficulty) => {
    // Red's three on the second row needs column 3 filled underneath: yellow must leave it alone.
    const board = drawBoard("RRR....", "YYR.Y..");
    for (const seed of SEEDS) expect(chooseComputerMove(board, "yellow", difficulty, seeded(seed))).not.toBe(3);
  });

  it.each(SEARCHING)("%s sets up a double threat it can't be stopped from completing", (difficulty) => {
    const board = drawBoard("..RR...", "..YY...");
    for (const seed of SEEDS) expect([1, 4]).toContain(chooseComputerMove(board, "yellow", difficulty, seeded(seed)));
  });

  it.each(SEARCHING)("%s opens in the centre", (difficulty) => {
    for (const seed of SEEDS) expect(chooseComputerMove(emptyBoard(), "red", difficulty, seeded(seed))).toBe(3);
  });

  it.each(DIFFICULTIES)("%s never picks a full column", (difficulty) => {
    const board = drawBoard("..RYR..", "..YRY..", "..RYR..", "..YRY..", "..RYR..", "..YRY..");
    const onlyOne = drawBoard("RYRY.YR", "YRYRYRY", "RYRYRYR", "YRYRYRY", "RYRYRYR", "YRYRYRY");
    for (const seed of SEEDS) {
      expect([0, 1, 5, 6]).toContain(chooseComputerMove(board, "red", difficulty, seeded(seed)));
      expect(chooseComputerMove(onlyOne, "yellow", difficulty, seeded(seed))).toBe(4);
    }
  });

  it("refuses a full board", () => {
    expect(() => chooseComputerMove(drawBoard(...Array<string>(6).fill("RYRYRYR")), "red", "hard")).toThrow();
  });

  it("hard plays a whole game quickly, move after move", () => {
    const random = seeded(7);
    let state = newGame(["computer", "rival"], "rival");
    let slowest = 0;
    while (state.winnerId === null && !state.draw) {
      let column: number;
      if (state.turn === "computer") {
        const started = performance.now();
        column = chooseComputerMove(state.board, "red", "hard", random);
        slowest = Math.max(slowest, performance.now() - started);
      } else {
        const legal = legalColumns(state.board);
        column = chooseComputerMove(state.board, "yellow", "medium", random);
        if (random() < 0.3) column = legal[Math.floor(random() * legal.length)];
      }
      expect(state.board[0][column]).toBeNull();
      state = playDrop(state, column);
    }
    expect(state.winnerId).toBe("computer");
    // Typically ~30ms at worst on a laptop; phones are a few times slower, which keeps it well under 300ms.
    expect(slowest).toBeLessThan(250);
  });
});
