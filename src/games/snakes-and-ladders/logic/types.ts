export interface SnlRoll {
  /** Increases by one per roll; clients animate rolls in this order. */
  seq: number;
  playerId: string;
  value: number;
  from: number;
  /** Square reached by the dice, before any snake or ladder. */
  landed: number;
  /** Final square after any snake or ladder. */
  to: number;
  via: "snake" | "ladder" | null;
  /**
   * moved: an ordinary move. overshoot: needed a smaller number to finish, so stayed put.
   * third-six: a third 6 in a row, which forfeits the move and the turn. won: reached 100.
   */
  outcome: "moved" | "overshoot" | "third-six" | "won";
  extraTurn: boolean;
  /** Rolled by the game because the player ran out of time. */
  auto: boolean;
}

export interface SnlState {
  /** Turn order (player ids). */
  order: string[];
  /** 0 means not on the board yet. */
  positions: Record<string, number>;
  turn: string;
  /** Server time the current turn began; it times out TURN_TIMEOUT_MS later. */
  turnStartedAt: number;
  /** Consecutive 6s rolled in the current turn. */
  sixStreak: number;
  rollCount: number;
  /** Recent rolls, newest first. */
  history: SnlRoll[];
  winnerId: string | null;
}

/** `seq` is the roll count the player saw, so a repeated or late request can't roll twice. */
export type SnlAction = { type: "roll"; seq: number } | { type: "claim_timeout"; seq: number };

export type SnlOptions = Record<string, never>;

/** A player who doesn't roll within this time has the game roll for them. */
export const TURN_TIMEOUT_MS = 30_000;
