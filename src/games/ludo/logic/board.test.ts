import { describe, expect, it } from "vitest";
import {
  BOARD_SIZE,
  cellOf,
  COLOR_SPACING,
  colorsFor,
  HOME_COLUMNS,
  isSafeSquare,
  TRACK,
  TRACK_LENGTH,
  trackIndex,
  YARD_ORIGINS,
} from "./board";
import { HOME, LAST_TRACK_STEP, YARD, type LudoColor } from "./types";

const COLORS = [0, 1, 2, 3] as const;
const key = ([row, col]: readonly [number, number]) => `${row},${col}`;
const touching = (a: readonly [number, number], b: readonly [number, number]) =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) === 1;

describe("Ludo board", () => {
  it("has a closed loop of 52 distinct, connected squares inside the board", () => {
    expect(TRACK).toHaveLength(TRACK_LENGTH);
    expect(new Set(TRACK.map(key)).size).toBe(TRACK_LENGTH);
    TRACK.forEach((cell, i) => {
      expect(cell.every((n) => n >= 0 && n < BOARD_SIZE)).toBe(true);
      expect(touching(cell, TRACK[(i + 1) % TRACK_LENGTH]), `square ${i}`).toBe(true);
    });
  });

  it("keeps the track out of the yards and the center", () => {
    for (const [row, col] of TRACK) {
      const inYard = (row < 6 || row > 8) && (col < 6 || col > 8);
      const inCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8;
      expect(inYard || inCenter).toBe(false);
    }
  });

  it("starts each color next to its own yard, a quarter of the way round from the last", () => {
    for (const color of COLORS) {
      const start = TRACK[color * COLOR_SPACING];
      const [yardRow, yardCol] = YARD_ORIGINS[color];
      // The start square borders the yard's edge.
      const nearYard =
        start[0] >= yardRow - 1 && start[0] <= yardRow + 6 && start[1] >= yardCol - 1 && start[1] <= yardCol + 6;
      expect(nearYard, `color ${color}`).toBe(true);
    }
  });

  it("leads each color from its last track square straight up its home column to the center", () => {
    for (const color of COLORS) {
      const path = Array.from({ length: HOME - 1 }, (_, step) => cellOf(color, step + 1)!);
      for (let i = 0; i + 1 < path.length; i++) {
        expect(touching(path[i], path[i + 1]), `color ${color}, step ${i + 1}`).toBe(true);
      }
      const column = HOME_COLUMNS[color];
      expect(column).toHaveLength(HOME - LAST_TRACK_STEP - 1);
      // The column's last square touches the 3 × 3 center.
      const [row, col] = column[column.length - 1];
      expect(row >= 5 && row <= 9 && col >= 5 && col <= 9).toBe(true);
      // Home columns never overlap the track.
      for (const cell of column) expect(TRACK.map(key)).not.toContain(key(cell));
    }
  });

  it("maps steps to squares relative to each color's start", () => {
    expect(trackIndex(0, 0)).toBe(0);
    expect(trackIndex(2, 0)).toBe(26);
    expect(trackIndex(3, 20)).toBe(7); // wraps past red's start
    expect(trackIndex(1, YARD)).toBeNull();
    expect(trackIndex(1, LAST_TRACK_STEP + 1)).toBeNull();
    expect(cellOf(0, YARD)).toBeNull();
    expect(cellOf(0, HOME)).toBeNull();
  });

  it("marks start squares and stars as safe", () => {
    const safe = Array.from({ length: TRACK_LENGTH }, (_, i) => i).filter(isSafeSquare);
    expect(safe).toEqual([0, 8, 13, 21, 26, 34, 39, 47]);
  });

  it("seats two players in opposite corners", () => {
    expect(colorsFor(2)).toEqual<LudoColor[]>([0, 2]);
    expect(colorsFor(3)).toEqual<LudoColor[]>([0, 1, 2]);
    expect(colorsFor(4)).toEqual<LudoColor[]>([0, 1, 2, 3]);
  });
});
