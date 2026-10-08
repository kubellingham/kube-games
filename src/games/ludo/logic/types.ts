/**
 * A token's progress along its own path. -1 is the yard; 0–50 is the shared track,
 * starting on the player's start square; 51–55 is their home column; 56 is home.
 */
export type TokenStep = number;

export const YARD = -1;
export const LAST_TRACK_STEP = 50;
export const HOME = 56;
export const TOKENS_PER_PLAYER = 4;

/** Board corners, clockwise from the top left. */
export type LudoColor = 0 | 1 | 2 | 3;

export interface LudoCapture {
  playerId: string;
  token: number;
  from: TokenStep;
}

export interface LudoMove {
  token: number;
  from: TokenStep;
  to: TokenStep;
  /** Opponents' tokens sent back to their yard. */
  captured: LudoCapture[];
}

export interface LudoRoll {
  /** Increases by one per roll; clients animate rolls in this order. */
  seq: number;
  playerId: string;
  value: number;
  /**
   * choosing: waiting for the player to pick a token. moved: a token moved.
   * no-move: no token could use the roll. third-six: a third 6 in a row forfeits the turn.
   * left: the player left the game before picking a token.
   */
  outcome: "choosing" | "moved" | "no-move" | "third-six" | "left";
  move: LudoMove | null;
  /** The player rolls again (a 6, a capture or a token reaching home). */
  extraTurn: boolean;
  /** Played by the game because the player ran out of time. */
  auto: boolean;
}

export interface LudoState {
  /** Turn order (player ids). */
  order: string[];
  colors: Record<string, LudoColor>;
  tokens: Record<string, TokenStep[]>;
  turn: string;
  /** roll: the current player rolls next. move: they pick a token for the roll they made. */
  phase: "roll" | "move";
  /** Tokens the current player may move with their roll (in the "move" phase). */
  movable: number[];
  /** Server time the current roll or pick began; it times out TURN_TIMEOUT_MS later. */
  turnStartedAt: number;
  /** Consecutive 6s rolled in the current turn. */
  sixStreak: number;
  /** Increases on every roll and every move; actions must name it. */
  step: number;
  rollCount: number;
  /** Recent rolls, newest first. */
  history: LudoRoll[];
  winnerId: string | null;
}

/** `step` is the state step the player saw, so a repeated or late request can't apply twice. */
export type LudoAction =
  | { type: "roll"; step: number }
  | { type: "move"; step: number; token: number }
  | { type: "claim_timeout"; step: number };

export type LudoOptions = Record<string, never>;

/** A player who doesn't roll or pick a token within this time has the game play for them. */
export const TURN_TIMEOUT_MS = 30_000;
