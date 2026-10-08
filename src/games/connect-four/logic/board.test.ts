import { describe, expect, it } from "vitest";
import { dropDisc, emptyBoard, isBoardFull, landingRow, legalColumns, winningCellsAt } from "./board";
import { drawBoard } from "./test-helpers";

const cells = (...pairs: [number, number][]) => pairs.map(([row, column]) => ({ row, column }));

describe("dropping discs", () => {
  it("starts with an empty 7×6 board", () => {
    const board = emptyBoard();
    expect(board).toHaveLength(6);
    for (const row of board) expect(row).toEqual([null, null, null, null, null, null, null]);
    expect(legalColumns(board)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("lands each disc in the lowest empty row", () => {
    const first = dropDisc(emptyBoard(), 3, "red")!;
    expect(first.row).toBe(5);
    expect(first.board[5][3]).toBe("red");

    const second = dropDisc(first.board, 3, "yellow")!;
    expect(second.row).toBe(4);
    expect(second.board[4][3]).toBe("yellow");
    expect(second.board[5][3]).toBe("red");
  });

  it("never changes the board it was given", () => {
    const board = emptyBoard();
    dropDisc(board, 0, "red");
    expect(board).toEqual(emptyBoard());
  });

  it("refuses full and nonexistent columns", () => {
    const board = drawBoard("R......", "Y......", "R......", "Y......", "R......", "Y......");
    expect(landingRow(board, 0)).toBeNull();
    expect(dropDisc(board, 0, "red")).toBeNull();
    expect(legalColumns(board)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(landingRow(board, -1)).toBeNull();
    expect(landingRow(board, 7)).toBeNull();
    expect(landingRow(board, 1.5)).toBeNull();
  });

  it("knows when the board is full", () => {
    expect(isBoardFull(emptyBoard())).toBe(false);
    expect(isBoardFull(drawBoard(...Array<string>(6).fill("RYRYRYR")))).toBe(true);
  });
});

describe("winningCellsAt", () => {
  it("finds a horizontal line", () => {
    const board = drawBoard("YYY....", "RRRR...");
    expect(winningCellsAt(board, 5, 3)).toEqual(cells([5, 0], [5, 1], [5, 2], [5, 3]));
    expect(winningCellsAt(board, 5, 0)).toHaveLength(4);
  });

  it("finds a vertical line", () => {
    const board = drawBoard("......Y", "......Y", "......Y", "R.....Y", "R.....R", "R.....R");
    expect(winningCellsAt(board, 0, 6)).toEqual(cells([0, 6], [1, 6], [2, 6], [3, 6]));
    expect(winningCellsAt(board, 3, 0)).toEqual([]);
  });

  it("finds a diagonal rising to the right", () => {
    const board = drawBoard(
      "...R...", //
      "..RY...",
      ".RYY...",
      "RYYR...",
    );
    expect(winningCellsAt(board, 2, 3)).toEqual(cells([2, 3], [3, 2], [4, 1], [5, 0]));
  });

  it("finds a diagonal falling to the right", () => {
    const board = drawBoard(
      "Y......", //
      "RY.....",
      "RRY....",
      "YRRY...",
    );
    expect(winningCellsAt(board, 5, 3)).toEqual(cells([2, 0], [3, 1], [4, 2], [5, 3]));
  });

  it("includes every disc of a line longer than four", () => {
    const board = drawBoard("YYY.YY.", "RRRRRR.");
    expect(winningCellsAt(board, 5, 3)).toHaveLength(6);
  });

  it("includes both lines when one disc completes two", () => {
    const board = drawBoard(
      "...R...", //
      "...R...",
      "...R...",
      "RRRRY..",
    );
    const won = winningCellsAt(board, 5, 3);
    expect(won).toHaveLength(7);
    expect(won).toContainEqual({ row: 2, column: 3 });
    expect(won).toContainEqual({ row: 5, column: 0 });
  });

  it("finds nothing for three in a row or an empty cell", () => {
    const board = drawBoard("RRR.Y.Y");
    expect(winningCellsAt(board, 5, 2)).toEqual([]);
    expect(winningCellsAt(board, 5, 3)).toEqual([]);
  });
});
