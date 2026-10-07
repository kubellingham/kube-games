import { secureRandom } from "@/lib/random";
import { MOVE_DETAILS, RPS_MOVES, type RpsMove } from "./moves";

export type RoundOutcome = "win" | "lose" | "draw";

/** The outcome from the point of view of whoever played `move`. */
export function getOutcome(move: RpsMove, opponentMove: RpsMove): RoundOutcome {
  if (move === opponentMove) return "draw";
  return MOVE_DETAILS[move].beats === opponentMove ? "win" : "lose";
}

/** A short explanation of a round, e.g. "Paper covers Rock". */
export function describeRound(move: RpsMove, opponentMove: RpsMove): string {
  if (move === opponentMove) return `Both played ${MOVE_DETAILS[move].label}`;
  const [winner, loser] =
    getOutcome(move, opponentMove) === "win" ? [move, opponentMove] : [opponentMove, move];
  return `${MOVE_DETAILS[winner].label} ${MOVE_DETAILS[winner].verb} ${MOVE_DETAILS[loser].label}`;
}

/**
 * A uniformly random move. Deliberately takes no input about the other
 * player's choice, so the computer cannot react to it.
 */
export function randomMove(random: () => number = secureRandom): RpsMove {
  return RPS_MOVES[Math.floor(random() * RPS_MOVES.length)];
}
