import { HOME, LAST_TRACK_STEP, YARD, type LudoColor, type TokenStep } from "./types";

/**
 * The classic 15 × 15 cross-shaped board. Cells are [row, col] with row 0 at the
 * top. Yards sit in the corners (red top left, then green, yellow and blue
 * clockwise), and tokens travel clockwise around the shared track.
 */
export type Cell = readonly [row: number, col: number];

export const BOARD_SIZE = 15;
export const TRACK_LENGTH = 52;
/** Squares between one color's start square and the next. */
export const COLOR_SPACING = 13;

const segment = (start: Cell, dRow: number, dCol: number, length: number): Cell[] =>
  Array.from({ length }, (_, i) => [start[0] + dRow * i, start[1] + dCol * i] as const);

/** The shared track, starting at red's start square. */
export const TRACK: readonly Cell[] = [
  ...segment([6, 1], 0, 1, 5),
  ...segment([5, 6], -1, 0, 6),
  [0, 7],
  ...segment([0, 8], 1, 0, 6),
  ...segment([6, 9], 0, 1, 6),
  [7, 14],
  ...segment([8, 14], 0, -1, 6),
  ...segment([9, 8], 1, 0, 6),
  [14, 7],
  ...segment([14, 6], -1, 0, 6),
  ...segment([8, 5], 0, -1, 6),
  [7, 0],
  [6, 0],
];

/** Each color's home column, from the track towards the center. */
export const HOME_COLUMNS: Readonly<Record<LudoColor, readonly Cell[]>> = {
  0: segment([7, 1], 0, 1, 5),
  1: segment([1, 7], 1, 0, 5),
  2: segment([7, 13], 0, -1, 5),
  3: segment([13, 7], -1, 0, 5),
};

/** Top-left cell of each color's 6 × 6 yard. */
export const YARD_ORIGINS: Readonly<Record<LudoColor, Cell>> = {
  0: [0, 0],
  1: [0, 9],
  2: [9, 9],
  3: [9, 0],
};

export const COLOR_NAMES: Readonly<Record<LudoColor, string>> = { 0: "Red", 1: "Green", 2: "Yellow", 3: "Blue" };
export const COLOR_HEX: Readonly<Record<LudoColor, string>> = {
  0: "#ef4444",
  1: "#22c55e",
  2: "#facc15",
  3: "#3b82f6",
};

/** Which colors play, by number of players: two players sit in opposite corners. */
export function colorsFor(playerCount: number): LudoColor[] {
  if (playerCount === 2) return [0, 2];
  return ([0, 1, 2, 3] as const).slice(0, playerCount);
}

/** Index into TRACK of a token on the shared track, or null if it's in the yard, home column or home. */
export function trackIndex(color: LudoColor, step: TokenStep): number | null {
  if (step < 0 || step > LAST_TRACK_STEP) return null;
  return (color * COLOR_SPACING + step) % TRACK_LENGTH;
}

/** Start squares and the star squares eight steps after them. Nobody can be captured there. */
export function isSafeSquare(index: number): boolean {
  const offset = index % COLOR_SPACING;
  return offset === 0 || offset === 8;
}

/** The cell a token is on, or null in the yard or at home (drawn separately). */
export function cellOf(color: LudoColor, step: TokenStep): Cell | null {
  if (step === YARD || step === HOME) return null;
  if (step <= LAST_TRACK_STEP) return TRACK[trackIndex(color, step)!];
  return HOME_COLUMNS[color][step - LAST_TRACK_STEP - 1];
}
