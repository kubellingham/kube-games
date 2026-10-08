import { COLUMNS, ROWS, type Board, type Cell } from "./types";

const CELLS: Record<string, Cell> = { ".": null, R: "red", Y: "yellow" };

/**
 * Builds a board from a picture, top row first, for tests: "R" red, "Y" yellow,
 * "." empty. Rows left out at the top are empty.
 */
export function drawBoard(...rows: string[]): Board {
  const padded = [...Array<string>(ROWS - rows.length).fill(".".repeat(COLUMNS)), ...rows];
  return padded.map((line) => {
    const cells = line.replace(/\s/g, "").split("");
    if (cells.length !== COLUMNS || padded.length !== ROWS) throw new Error(`Bad board row: "${line}"`);
    return cells.map((char) => {
      if (!(char in CELLS)) throw new Error(`Bad board cell: "${char}"`);
      return CELLS[char];
    });
  });
}
