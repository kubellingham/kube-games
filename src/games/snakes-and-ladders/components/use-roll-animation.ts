"use client";

import { useEffect, useState } from "react";
import type { SnlRoll, SnlState } from "../logic/types";

const HOP_MS = 170;
const JUMP_PAUSE_MS = 220;
const JUMP_MS = 650;
const SETTLE_MS = 350;
/** If more rolls than this are waiting (e.g. the tab was in the background), skip ahead. */
const MAX_QUEUE = 4;

export interface RollAnimation {
  /** Where each token should be drawn right now. */
  positions: Record<string, number>;
  /** The roll being animated, or the latest one once animations have caught up. */
  shownRoll: SnlRoll | null;
  animating: boolean;
  /** Token currently sliding along a snake or ladder (drawn with a slower transition). */
  jumpingPlayerId: string | null;
}

interface Frame {
  pos: number;
  jump: boolean;
  at: number;
}

/** Token positions over time for one roll; the last frame only marks the end. */
function framesFor(roll: SnlRoll): Frame[] {
  const frames: Frame[] = [];
  let at = 0;
  if (roll.outcome === "moved" || roll.outcome === "won") {
    for (let square = roll.from + 1; square <= roll.landed; square++) {
      frames.push({ pos: square, jump: false, at });
      at += HOP_MS;
    }
    if (roll.via) {
      at += JUMP_PAUSE_MS;
      frames.push({ pos: roll.to, jump: true, at });
      at += JUMP_MS;
    }
  }
  frames.push({ pos: roll.to, jump: false, at: at + SETTLE_MS });
  return frames;
}

/**
 * Turns server state into an animation: each new roll hops the token square by
 * square, then slides it along any snake or ladder. Rolls play strictly in order.
 */
export function useRollAnimation(state: SnlState): RollAnimation {
  // Rolls that existed when the board first appeared are shown as-is, not replayed.
  const [doneSeq, setDoneSeq] = useState(state.rollCount);
  const [frame, setFrame] = useState<{ seq: number; pos: number; jump: boolean } | null>(null);

  // A new game restarts the roll count.
  if (state.rollCount < doneSeq) {
    setDoneSeq(state.rollCount);
    setFrame(null);
  }

  const pending = state.history.filter((roll) => roll.seq > doneSeq).sort((a, b) => a.seq - b.seq);
  const rollsMissing = state.rollCount - doneSeq > pending.length;
  const skip = rollsMissing || pending.length > MAX_QUEUE;
  const current = skip ? null : (pending[0] ?? null);
  // A stable key, so refetching identical state doesn't restart the animation.
  const currentKey = current ? JSON.stringify(current) : null;

  useEffect(() => {
    if (skip) {
      const timer = setTimeout(() => setDoneSeq(state.rollCount), 0);
      return () => clearTimeout(timer);
    }
    if (!currentKey) return;
    const roll = JSON.parse(currentKey) as SnlRoll;
    const frames = framesFor(roll);
    const timers = frames.map((f, i) =>
      setTimeout(() => {
        if (i === frames.length - 1) {
          setFrame(null);
          setDoneSeq(roll.seq);
        } else {
          setFrame({ seq: roll.seq, pos: f.pos, jump: f.jump });
        }
      }, f.at),
    );
    return () => timers.forEach(clearTimeout);
  }, [currentKey, skip, state.rollCount]);

  const positions = { ...state.positions };
  if (!skip) {
    // Tokens with rolls still to play wait where their first pending roll started.
    for (const roll of [...pending].reverse()) {
      if (roll.playerId in positions) positions[roll.playerId] = roll.from;
    }
    if (current && frame?.seq === current.seq && current.playerId in positions) {
      positions[current.playerId] = frame.pos;
    }
  }

  return {
    positions,
    shownRoll: current ?? state.history[0] ?? null,
    animating: current !== null || skip,
    jumpingPlayerId: current && frame?.seq === current.seq && frame.jump ? current.playerId : null,
  };
}
