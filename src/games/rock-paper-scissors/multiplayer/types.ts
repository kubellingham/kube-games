import type { RpsMove } from "../logic/moves";

export interface RpsRoundResult {
  round: number;
  moves: Record<string, RpsMove>;
  /** Null for a draw. */
  winnerId: string | null;
}

/** Public state: everyone in the room can see this. */
export interface RpsState {
  /** The round currently waiting for moves. */
  round: number;
  scores: Record<string, number>;
  draws: number;
  /** Who has sealed a move this round. The moves themselves are secrets. */
  lockedIn: string[];
  /** Revealed rounds, newest first. */
  history: RpsRoundResult[];
  matchWinnerId: string | null;
}

/** A player's sealed move, visible only to that player until the reveal. */
export interface RpsSecret {
  round: number;
  move: RpsMove;
}

export interface RpsOptions {
  /** First player to reach this many wins takes the match; null plays forever. */
  targetScore: number | null;
}

export type RpsAction = { type: "submit_move"; round: number; move: RpsMove };

export const RPS_TARGET_SCORE_CHOICES: readonly (number | null)[] = [3, 5, null];

export const DEFAULT_RPS_OPTIONS: RpsOptions = { targetScore: 3 };
