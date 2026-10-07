"use client";

import { useEffect, useEffectEvent } from "react";
import { cn } from "@/lib/cn";
import { MOVE_DETAILS, RPS_MOVES, type RpsMove } from "../logic/moves";

const SHORTCUTS: Record<string, RpsMove> = { r: "rock", p: "paper", s: "scissors" };

/** Lets keyboard players press R, P or S to pick a move. */
export function useMoveShortcuts(onMove: (move: RpsMove) => void, enabled: boolean) {
  const handleMove = useEffectEvent(onMove);
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]")) return;
      const move = SHORTCUTS[event.key.toLowerCase()];
      if (move) {
        event.preventDefault();
        handleMove(move);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}

export function MovePicker({
  onPick,
  disabled = false,
  pendingMove = null,
}: {
  onPick: (move: RpsMove) => void;
  disabled?: boolean;
  pendingMove?: RpsMove | null;
}) {
  return (
    <div role="group" aria-label="Choose your move" className="grid grid-cols-3 gap-3 sm:gap-4">
      {RPS_MOVES.map((move) => {
        const { emoji, label } = MOVE_DETAILS[move];
        const shortcut = move[0].toUpperCase();
        return (
          <button
            key={move}
            type="button"
            onClick={() => onPick(move)}
            disabled={disabled}
            aria-keyshortcuts={shortcut}
            className={cn(
              "group relative flex min-h-32 flex-col items-center justify-center gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-3 transition duration-200 sm:min-h-44",
              "hover:-translate-y-1 hover:border-fuchsia-400/60 hover:bg-fuchsia-500/10 hover:shadow-xl hover:shadow-fuchsia-500/20 active:scale-95",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300",
              "disabled:pointer-events-none disabled:opacity-40",
              pendingMove === move && "border-fuchsia-400/70 bg-fuchsia-500/15 opacity-100!",
            )}
          >
            <span
              aria-hidden
              className="text-5xl transition duration-200 group-hover:scale-110 group-hover:-rotate-6 sm:text-7xl"
            >
              {emoji}
            </span>
            <span className="text-sm font-semibold sm:text-base">{label}</span>
            <kbd aria-hidden className="absolute top-2.5 right-3 hidden font-mono text-[10px] text-zinc-500 sm:block">
              {shortcut}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}
