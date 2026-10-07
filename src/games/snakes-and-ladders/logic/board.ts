export const FINAL_SQUARE = 100;
export const BOARD_COLUMNS = 10;

/** The classic board: ladder foot → top. */
export const LADDERS: Readonly<Record<number, number>> = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
};

/** The classic board: snake head → tail. */
export const SNAKES: Readonly<Record<number, number>> = {
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78,
};

export type Jump = { to: number; via: "snake" | "ladder" };

export function jumpFrom(square: number): Jump | null {
  if (LADDERS[square] !== undefined) return { to: LADDERS[square], via: "ladder" };
  if (SNAKES[square] !== undefined) return { to: SNAKES[square], via: "snake" };
  return null;
}

/**
 * Where a square sits on screen (row 0 is the top). Square 1 is bottom-left and
 * the numbering snakes back and forth, so 100 ends up top-left.
 */
export function squareToCell(square: number): { row: number; col: number } {
  const index = square - 1;
  const rowFromBottom = Math.floor(index / BOARD_COLUMNS);
  const offset = index % BOARD_COLUMNS;
  const col = rowFromBottom % 2 === 0 ? offset : BOARD_COLUMNS - 1 - offset;
  return { row: BOARD_COLUMNS - 1 - rowFromBottom, col };
}
