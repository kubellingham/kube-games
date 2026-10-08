export const COLUMNS = 7;
export const ROWS = 6;
/** Discs in a row needed to win. */
export const CONNECT = 4;

export type Disc = "red" | "yellow";

/** A disc, or null for an empty space. */
export type Cell = Disc | null;

/** `board[row][column]`. Row 0 is the top row, so discs settle at the highest free row index. */
export type Board = Cell[][];

export interface CellPos {
  row: number;
  column: number;
}

export interface C4Move extends CellPos {
  playerId: string;
}

/** One game of Connect Four. Plain JSON, so the server can store it on the room as-is. */
export interface C4State {
  /** Player ids in seat order: the first plays Red, the second Yellow. */
  players: [string, string];
  board: Board;
  /** Whose move it is. Once the game is over, the player who made the last move. */
  turn: string;
  /** Who moved first this game. */
  firstPlayerId: string;
  moveCount: number;
  /** The latest drop, so clients can animate it. */
  lastMove: C4Move | null;
  winnerId: string | null;
  draw: boolean;
  /** Every disc in the winning line(s), empty until someone wins. */
  winningCells: CellPos[];
}

/** `seq` is the move count the player saw, so a repeated or late request can't play twice. */
export type C4Action = { type: "drop"; column: number; seq: number };

export type C4Options = Record<string, never>;
