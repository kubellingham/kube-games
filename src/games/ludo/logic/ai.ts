import { isSafeSquare, TRACK_LENGTH, trackIndex } from "./board";
import { capturesAt, targetStep } from "./rules";
import { HOME, LAST_TRACK_STEP, YARD, type LudoState, type TokenStep } from "./types";

/** Whether an opponent could land on this square of the track with their next roll. */
function threatened(state: LudoState, playerId: string, step: TokenStep): boolean {
  const square = trackIndex(state.colors[playerId], step);
  if (square === null || isSafeSquare(square)) return false;
  return state.order.some(
    (other) =>
      other !== playerId &&
      state.tokens[other].some((theirStep) => {
        const theirs = trackIndex(state.colors[other], theirStep);
        if (theirs === null) return false;
        const distance = (square - theirs + TRACK_LENGTH) % TRACK_LENGTH;
        // They must still be on the shared track when they get there.
        return distance >= 1 && distance <= 6 && theirStep + distance <= LAST_TRACK_STEP;
      }),
  );
}

/** How good moving this token is for the player whose turn it is. */
export function scoreMove(state: LudoState, token: number): number {
  const playerId = state.turn;
  const value = state.history[0].value;
  const from = state.tokens[playerId][token];
  const to = targetStep(from, value)!;
  const square = trackIndex(state.colors[playerId], to);

  let score = to / 10;
  score += capturesAt(state, playerId, to).reduce((sum, capture) => sum + 100 + capture.from, 0);
  if (to === HOME) score += 60;
  if (from === YARD) score += 70;
  if (from <= LAST_TRACK_STEP && to > LAST_TRACK_STEP) score += 40;
  if (square !== null && isSafeSquare(square)) score += 25;
  if (threatened(state, playerId, to)) score -= 50;
  if (from !== YARD && threatened(state, playerId, from)) score += 30;
  return score;
}

/**
 * Picks a token to move for the current player: capture, get home, come out of
 * the yard and reach safety; avoid stopping where an opponent can capture.
 * `jitter` adds a little variety for computer opponents.
 */
export function chooseMove(state: LudoState, jitter?: () => number): number {
  let best = state.movable[0];
  let bestScore = -Infinity;
  for (const token of state.movable) {
    const score = scoreMove(state, token) + (jitter ? jitter() * 8 : 0);
    if (score > bestScore) {
      best = token;
      bestScore = score;
    }
  }
  return best;
}
