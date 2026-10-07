export const RPS_MOVES = ["rock", "paper", "scissors"] as const;

export type RpsMove = (typeof RPS_MOVES)[number];

interface MoveDetails {
  label: string;
  emoji: string;
  beats: RpsMove;
  /** How this move defeats the one it beats, e.g. "Rock crushes Scissors". */
  verb: string;
}

export const MOVE_DETAILS: Record<RpsMove, MoveDetails> = {
  rock: { label: "Rock", emoji: "🪨", beats: "scissors", verb: "crushes" },
  paper: { label: "Paper", emoji: "📄", beats: "rock", verb: "covers" },
  scissors: { label: "Scissors", emoji: "✂️", beats: "paper", verb: "cut" },
};

export function isRpsMove(value: unknown): value is RpsMove {
  return typeof value === "string" && (RPS_MOVES as readonly string[]).includes(value);
}
