"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { MAX_HOLD_MS } from "../logic/types";

/** Which cells of a 3×3 grid hold a pip, for each face. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Alternating 50ms buzz / 50ms pause for the whole hold (Android only; other browsers ignore it).
const HOLD_VIBRATION: number[] = new Array(MAX_HOLD_MS / 50).fill(50);

export function DieFace({ value, spinning = false, className }: { value: number; spinning?: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid aspect-square grid-cols-3 grid-rows-3 gap-[7%] rounded-[22%] bg-linear-to-br from-white to-zinc-200 p-[15%] shadow-[inset_0_-5px_0_rgb(0_0_0/0.12),0_12px_24px_-6px_rgb(0_0_0/0.6)]",
        spinning && "animate-dice-tumble",
        className,
      )}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={cn("rounded-full", PIPS[value]?.includes(i) && "bg-ink-950")} />
      ))}
    </div>
  );
}

/**
 * The dice pad: press and hold (finger, mouse or Space bar) to spin, let go to
 * roll. The hold is only for suspense; the roll itself is decided elsewhere
 * (by the server online). Lets go automatically after MAX_HOLD_MS.
 */
export function HoldDicePad({
  value,
  landKey,
  canHold,
  spinning,
  title,
  detail,
  onHoldStart,
  onRelease,
}: {
  /** Face to show when not spinning (the last roll), or null before any roll. */
  value: number | null;
  /** Changes whenever a new roll lands, to replay the landing bounce. */
  landKey: string | number | null;
  canHold: boolean;
  /** Spin without being held, e.g. while another player holds or a roll is in flight. */
  spinning: boolean;
  title: string;
  detail?: string;
  onHoldStart?: () => void;
  onRelease: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const [face, setFace] = useState(1);
  const holdingRef = useRef(false);
  const callbacks = useRef({ onHoldStart, onRelease, canHold });
  useLayoutEffect(() => {
    callbacks.current = { onHoldStart, onRelease, canHold };
  });

  const begin = useCallback(() => {
    if (holdingRef.current || !callbacks.current.canHold) return;
    holdingRef.current = true;
    setHolding(true);
    navigator.vibrate?.(HOLD_VIBRATION);
    callbacks.current.onHoldStart?.();
  }, []);

  const release = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    navigator.vibrate?.(0);
    callbacks.current.onRelease();
  }, []);

  // Let go automatically so nobody can stall the game.
  useEffect(() => {
    if (!holding) return;
    const timer = setTimeout(release, MAX_HOLD_MS);
    return () => clearTimeout(timer);
  }, [holding, release]);

  const active = holding || spinning;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setFace((f) => (f + 1 + Math.floor(Math.random() * 4)) % 6 + 1), 80);
    return () => clearInterval(timer);
  }, [active]);

  // Space bar works like holding the pad, without needing to focus it first.
  useEffect(() => {
    if (!canHold) return;
    const isTyping = (event: KeyboardEvent) =>
      event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]");
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isTyping(event)) return;
      event.preventDefault();
      begin();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [canHold, begin, release]);

  // Release a hold that outlives the pad (e.g. navigating away mid-hold).
  useEffect(
    () => () => {
      navigator.vibrate?.(0);
    },
    [],
  );

  return (
    <button
      type="button"
      disabled={!canHold && !holding}
      data-testid="dice-pad"
      data-holding={holding || undefined}
      aria-label={canHold ? "Hold to roll the dice, release to stop" : title}
      onPointerDown={(event) => {
        if (!canHold) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        begin();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        "relative flex min-h-40 w-full touch-none flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border p-5 select-none [-webkit-touch-callout:none]",
        "transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300",
        canHold
          ? "cursor-pointer border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/15"
          : "cursor-default border-white/10 bg-white/[0.03]",
        holding && "scale-[0.98] border-emerald-300 bg-emerald-400/20",
      )}
    >
      <div key={active ? "spinning" : `landed-${landKey}`} className={cn("w-20 sm:w-24", !active && landKey !== null && "animate-dice-land")}>
        <DieFace value={active ? face : (value ?? 6)} spinning={active} className={!active && value === null ? "opacity-40" : undefined} />
      </div>
      <span className="text-center">
        <span className="block font-semibold">{holding ? "Let go to roll!" : title}</span>
        {!holding && detail && <span className="mt-0.5 block text-sm text-zinc-400">{detail}</span>}
      </span>
      {holding && (
        <span aria-hidden className="absolute inset-x-8 bottom-3 h-1 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full origin-left animate-hold-progress rounded-full bg-emerald-300" />
        </span>
      )}
    </button>
  );
}
