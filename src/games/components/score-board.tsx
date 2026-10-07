import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PlayerIndicator, type Connection } from "./player-indicator";

export interface ScoreSide {
  name: string;
  score: number;
  isYou?: boolean;
  status?: string;
  statusTone?: "neutral" | "success" | "warning";
  connection?: Connection;
}

function Side({ side, align }: { side: ScoreSide; align: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", align === "right" && "items-end")}>
      <PlayerIndicator {...side} align={align} />
      <span
        // Re-mount on change so the new score pops.
        key={side.score}
        className="animate-pop-in font-display text-4xl font-black tabular-nums sm:text-5xl"
        aria-label={`${side.name}: ${side.score}`}
      >
        {side.score}
      </span>
    </div>
  );
}

/** Two players' scores with round information in the middle. */
export function ScoreBoard({ left, right, center }: { left: ScoreSide; right: ScoreSide; center?: ReactNode }) {
  return (
    <section
      aria-label="Score"
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:gap-6 sm:p-5"
    >
      <Side side={left} align="left" />
      <div className="flex flex-col items-center gap-1 text-center text-xs text-zinc-400">{center}</div>
      <Side side={right} align="right" />
    </section>
  );
}
