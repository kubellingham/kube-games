export interface C4Stats {
  wins: number;
  losses: number;
  draws: number;
}

export type C4Outcome = "win" | "loss" | "draw";

export const EMPTY_STATS: C4Stats = { wins: 0, losses: 0, draws: 0 };

export function recordOutcome(stats: C4Stats, outcome: C4Outcome): C4Stats {
  return {
    wins: stats.wins + (outcome === "win" ? 1 : 0),
    losses: stats.losses + (outcome === "loss" ? 1 : 0),
    draws: stats.draws + (outcome === "draw" ? 1 : 0),
  };
}

export function gamesPlayed(stats: C4Stats): number {
  return stats.wins + stats.losses + stats.draws;
}

/** Restores saved stats, ignoring anything malformed. */
export function parseStats(raw: string | null): C4Stats {
  if (!raw) return EMPTY_STATS;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return EMPTY_STATS;
    const { wins, losses, draws } = value as Record<string, unknown>;
    if (![wins, losses, draws].every((n) => Number.isSafeInteger(n) && (n as number) >= 0)) return EMPTY_STATS;
    return { wins: wins as number, losses: losses as number, draws: draws as number };
  } catch {
    return EMPTY_STATS;
  }
}
