import { describe, expect, it } from "vitest";
import { discOf, isGameOver, newGame, opponentOf, playDrop } from "./rules";
import { drawBoard } from "./test-helpers";

const start = newGame(["ann", "ben"], "ann");

/** A full board with no four in a row anywhere. */
const DRAWN_ROWS = ["RRYYRRY", "YYRRYYR", "RRYYRRY", "YYRRYYR", "RRYYRRY", "YYRRYYR"];

describe("newGame", () => {
  it("starts an empty board with the chosen player to move", () => {
    expect(start).toMatchObject({ players: ["ann", "ben"], turn: "ann", firstPlayerId: "ann", moveCount: 0 });
    expect(start.board.flat().every((cell) => cell === null)).toBe(true);
    expect(newGame(["ann", "ben"], "ben").turn).toBe("ben");
    expect(() => newGame(["ann", "ben"], "eve")).toThrow();
  });

  it("gives seat 0 the red discs and seat 1 the yellow", () => {
    expect(discOf(start, "ann")).toBe("red");
    expect(discOf(start, "ben")).toBe("yellow");
    expect(opponentOf(start, "ann")).toBe("ben");
    expect(opponentOf(start, "ben")).toBe("ann");
  });
});

describe("playDrop", () => {
  it("drops the mover's disc, records the move and passes the turn", () => {
    const one = playDrop(start, 3);
    expect(one.board[5][3]).toBe("red");
    expect(one).toMatchObject({ turn: "ben", moveCount: 1, lastMove: { row: 5, column: 3, playerId: "ann" } });

    const two = playDrop(one, 3);
    expect(two.board[4][3]).toBe("yellow");
    expect(two).toMatchObject({ turn: "ann", moveCount: 2, lastMove: { row: 4, column: 3, playerId: "ben" } });
    // The earlier state is untouched.
    expect(one.board[4][3]).toBeNull();
  });

  it("ends the game when a line of four is made", () => {
    let state = start;
    for (const column of [0, 0, 1, 1, 2, 2]) state = playDrop(state, column);
    expect(isGameOver(state)).toBe(false);

    const won = playDrop(state, 3);
    expect(won).toMatchObject({ winnerId: "ann", draw: false, turn: "ann", moveCount: 7 });
    expect(won.winningCells).toEqual([0, 1, 2, 3].map((column) => ({ row: 5, column })));
    expect(isGameOver(won)).toBe(true);
    expect(() => playDrop(won, 4)).toThrow();
  });

  it("is a draw when the last space is filled without a line", () => {
    const board = drawBoard(".RYYRRY", ...DRAWN_ROWS.slice(1));
    const state = { ...start, board, moveCount: 41 };
    const drawn = playDrop(state, 0);
    expect(drawn).toMatchObject({ draw: true, winnerId: null, winningCells: [], moveCount: 42 });
    expect(isGameOver(drawn)).toBe(true);
  });

  it("counts a line made with the very last disc as a win, not a draw", () => {
    const board = drawBoard(".RRRYYY", ...DRAWN_ROWS.slice(1));
    const won = playDrop({ ...start, board, moveCount: 41 }, 0);
    expect(won).toMatchObject({ winnerId: "ann", draw: false, moveCount: 42 });
    expect(won.winningCells).toEqual([0, 1, 2, 3].map((column) => ({ row: 0, column })));
  });

  it("refuses a full column", () => {
    let state = start;
    for (let i = 0; i < 6; i++) state = playDrop(state, 6);
    expect(() => playDrop(state, 6)).toThrow(/full/);
  });
});
