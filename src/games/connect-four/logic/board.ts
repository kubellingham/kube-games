import { COLUMNS, CONNECT, ROWS, type Board, type CellPos, type Disc } from "./types";

/** The four line directions: across, down, and both diagonals (as [row step, column step]). */
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Disc | null>(COLUMNS).fill(null));
}

export function otherDisc(disc: Disc): Disc {
  return disc === "red" ? "yellow" : "red";
}

export function isColumn(column: number): boolean {
  return Number.isInteger(column) && column >= 0 && column < COLUMNS;
}

/** The row a disc dropped in `column` lands in, or null if the column is full (or doesn't exist). */
export function landingRow(board: Board, column: number): number | null {
  if (!isColumn(column)) return null;
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][column] === null) return row;
  }
  return null;
}

/** Columns that still have space, left to right. */
export function legalColumns(board: Board): number[] {
  return Array.from({ length: COLUMNS }, (_, column) => column).filter((column) => board[0][column] === null);
}

export function isBoardFull(board: Board): boolean {
  return board[0].every((cell) => cell !== null);
}

/** Drops a disc into a column, returning the new board and the row it landed in (null if the column is full). */
export function dropDisc(board: Board, column: number, disc: Disc): { board: Board; row: number } | null {
  const row = landingRow(board, column);
  if (row === null) return null;
  const next = board.map((cells, r) => (r === row ? cells.map((cell, c) => (c === column ? disc : cell)) : cells));
  return { board: next, row };
}

/**
 * Every disc in a line of four or more through the given cell, in its colour, in
 * any direction. Lines longer than four are included whole; two lines crossing
 * at the cell are both included. Empty when the cell doesn't complete a line.
 */
export function winningCellsAt(board: Board, row: number, column: number): CellPos[] {
  const disc = board[row]?.[column];
  if (!disc) return [];
  const cells: CellPos[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line: CellPos[] = [{ row, column }];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = column + dc * sign;
      while (board[r]?.[c] === disc) {
        line.push({ row: r, column: c });
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= CONNECT) cells.push(...(cells.length ? line.slice(1) : line));
  }
  return cells.sort((a, b) => a.row - b.row || a.column - b.column);
}
