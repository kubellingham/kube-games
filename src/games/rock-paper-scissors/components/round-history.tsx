import { cn } from "@/lib/cn";
import { MOVE_DETAILS, type RpsMove } from "../logic/moves";
import { getOutcome } from "../logic/rules";

export interface HistoryEntry {
  round: number;
  you: RpsMove;
  opponent: RpsMove;
}

const TONE = {
  win: "bg-emerald-400/10 ring-emerald-400/25",
  lose: "bg-rose-400/10 ring-rose-400/25",
  draw: "bg-white/[0.05] ring-white/10",
};

const SPOKEN = { win: "won", lose: "lost", draw: "draw" };

/** Recent rounds, newest first, from the viewer's point of view. */
export function RoundHistory({ rounds, opponentName }: { rounds: HistoryEntry[]; opponentName: string }) {
  if (rounds.length === 0) return null;
  return (
    <section aria-label="Recent rounds">
      <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">Recent rounds</h3>
      <ol className="flex flex-wrap gap-2">
        {rounds.map(({ round, you, opponent }) => {
          const outcome = getOutcome(you, opponent);
          return (
            <li
              key={round}
              className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-inset", TONE[outcome])}
            >
              <span className="text-xs text-zinc-400">R{round}</span>
              <span aria-hidden>{MOVE_DETAILS[you].emoji}</span>
              <span aria-hidden className="text-xs text-zinc-500">
                vs
              </span>
              <span aria-hidden>{MOVE_DETAILS[opponent].emoji}</span>
              <span className="sr-only">
                You played {MOVE_DETAILS[you].label}, {opponentName} played {MOVE_DETAILS[opponent].label}:{" "}
                {SPOKEN[outcome]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
