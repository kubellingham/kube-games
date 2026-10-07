import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { MOVE_DETAILS, type RpsMove } from "../logic/moves";
import { describeRound, getOutcome, type RoundOutcome } from "../logic/rules";

const OUTCOME: Record<RoundOutcome, { title: string; text: string; ring: string }> = {
  win: { title: "You win!", text: "from-emerald-300 to-teal-200", ring: "ring-emerald-400/70 bg-emerald-400/10" },
  lose: { title: "You lose", text: "from-rose-300 to-orange-200", ring: "ring-rose-400/60 bg-rose-400/5" },
  draw: { title: "Draw", text: "from-zinc-100 to-zinc-400", ring: "ring-white/20" },
};

const OPPOSITE: Record<RoundOutcome, RoundOutcome> = { win: "lose", lose: "win", draw: "draw" };

function Hand({ label, move, outcome, mirrored }: { label: string; move: RpsMove; outcome: RoundOutcome; mirrored?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <p className="max-w-full truncate text-xs font-semibold tracking-wider text-zinc-400 uppercase">{label}</p>
      <div className="relative grid aspect-square w-full max-w-44 place-items-center rounded-3xl border border-white/10 bg-white/[0.04]">
        <span aria-hidden className={cn("reveal-move absolute inset-0 rounded-3xl ring-2 ring-inset", OUTCOME[outcome].ring)} />
        <span aria-hidden className={cn("reveal-countdown absolute text-6xl sm:text-8xl", mirrored && "-scale-x-100")}>
          ✊
        </span>
        <span aria-hidden className="reveal-move text-6xl sm:text-8xl">
          {MOVE_DETAILS[move].emoji}
        </span>
      </div>
      <p className="reveal-move font-semibold">{MOVE_DETAILS[move].label}</p>
    </div>
  );
}

export function OutcomeBanner({ outcome, detail }: { outcome: RoundOutcome; detail: string }) {
  return (
    <div>
      <p
        className={cn(
          "bg-linear-to-r bg-clip-text font-display text-4xl font-black tracking-tight text-transparent uppercase sm:text-5xl",
          OUTCOME[outcome].text,
        )}
      >
        {OUTCOME[outcome].title}
      </p>
      <p className="mt-1 text-sm text-zinc-400">{detail}</p>
    </div>
  );
}

/**
 * Both moves side by side. Fists shake briefly, then both moves appear at the
 * same moment, then the result. Re-mount (via `key`) to replay for a new round.
 */
export function RoundReveal({
  you,
  opponent,
  children,
}: {
  you: { name: string; move: RpsMove };
  opponent: { name: string; move: RpsMove };
  children?: ReactNode;
}) {
  const outcome = getOutcome(you.move, opponent.move);
  const detail = describeRound(you.move, opponent.move);

  return (
    <div className="flex flex-col items-center gap-6" data-testid="round-reveal" data-outcome={outcome}>
      <p className="sr-only" role="status">
        You played {MOVE_DETAILS[you.move].label}. {opponent.name} played {MOVE_DETAILS[opponent.move].label}.{" "}
        {OUTCOME[outcome].title} {detail}.
      </p>
      <div className="grid w-full max-w-xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
        <Hand label={you.name} move={you.move} outcome={outcome} />
        <span aria-hidden className="font-display text-lg font-black text-zinc-500">
          VS
        </span>
        <Hand label={opponent.name} move={opponent.move} outcome={OPPOSITE[outcome]} mirrored />
      </div>
      <div aria-hidden className="reveal-result text-center">
        <OutcomeBanner outcome={outcome} detail={detail} />
      </div>
      {children && <div className="reveal-result flex w-full flex-col items-center gap-3">{children}</div>}
    </div>
  );
}
