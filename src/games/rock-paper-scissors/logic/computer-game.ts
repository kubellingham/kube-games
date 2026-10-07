import type { RpsMove } from "./moves";
import { getOutcome, type RoundOutcome } from "./rules";

export interface ComputerRound {
  round: number;
  playerMove: RpsMove;
  computerMove: RpsMove;
  outcome: RoundOutcome;
}

export interface ComputerGameStats {
  wins: number;
  losses: number;
  draws: number;
}

export interface ComputerGameState {
  stats: ComputerGameStats;
  lastRound: ComputerRound | null;
}

export type ComputerGameAction =
  | { type: "play"; playerMove: RpsMove; computerMove: RpsMove }
  | { type: "reset" };

export const initialComputerGameState: ComputerGameState = {
  stats: { wins: 0, losses: 0, draws: 0 },
  lastRound: null,
};

export function totalRounds(stats: ComputerGameStats): number {
  return stats.wins + stats.losses + stats.draws;
}

export function computerGameReducer(
  state: ComputerGameState,
  action: ComputerGameAction,
): ComputerGameState {
  switch (action.type) {
    case "play": {
      const outcome = getOutcome(action.playerMove, action.computerMove);
      const stats = {
        wins: state.stats.wins + (outcome === "win" ? 1 : 0),
        losses: state.stats.losses + (outcome === "lose" ? 1 : 0),
        draws: state.stats.draws + (outcome === "draw" ? 1 : 0),
      };
      return {
        stats,
        lastRound: {
          round: totalRounds(stats),
          playerMove: action.playerMove,
          computerMove: action.computerMove,
          outcome,
        },
      };
    }
    case "reset":
      return initialComputerGameState;
  }
}

/** Restores saved stats, ignoring anything malformed. */
export function parseStoredStats(raw: string | null): ComputerGameStats | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { wins, losses, draws } = value as Record<string, unknown>;
    const counts = [wins, losses, draws];
    if (!counts.every((n) => Number.isSafeInteger(n) && (n as number) >= 0)) return null;
    return { wins: wins as number, losses: losses as number, draws: draws as number };
  } catch {
    return null;
  }
}
