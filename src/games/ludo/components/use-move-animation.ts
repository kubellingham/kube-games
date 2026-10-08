"use client";

import { useEffect, useState } from "react";
import { YARD, type LudoMove, type LudoRoll, type LudoState, type TokenStep } from "../logic/types";

/** Time for the dice to land before the token sets off. */
const DICE_MS = 450;
const HOP_MS = 150;
const LEAVE_YARD_MS = 260;
const CAPTURE_PAUSE_MS = 180;
const RETURN_MS = 520;
const SETTLE_MS = 250;
/** How long a roll that moves nothing stays on screen before play continues. */
const NO_MOVE_MS = 900;
/** If more rolls than this are waiting (e.g. the tab was in the background), skip ahead. */
const MAX_QUEUE = 4;

export interface TokenRef {
  playerId: string;
  token: number;
}

export interface MoveAnimation {
  /** Where each token should be drawn right now. */
  tokens: Record<string, TokenStep[]>;
  /** The roll being animated, or the latest one once animations have caught up. */
  shownRoll: LudoRoll | null;
  animating: boolean;
  /** The token hopping right now. */
  moving: TokenRef | null;
  /** Captured tokens sliding back to their yard (drawn with a slower transition). */
  returning: TokenRef[];
}

/**
 * Progress is counted in two marks per roll: 2·seq − 1 once its dice has landed,
 * 2·seq once it has played out. A roll waiting for the player to pick a token
 * stops at the first mark.
 */
const rolledMark = (seq: number) => 2 * seq - 1;
const playedMark = (roll: LudoRoll) => (roll.outcome === "choosing" ? rolledMark(roll.seq) : 2 * roll.seq);

interface Frame {
  at: number;
  /** The moving token's step; absent on the final frame, which only marks the end. */
  step?: TokenStep;
  capturedHome?: boolean;
}

function framesFor(roll: LudoRoll, showDice: boolean): Frame[] {
  const frames: Frame[] = [];
  let at = showDice ? DICE_MS : 0;
  const move = roll.outcome === "moved" ? roll.move : null;
  if (move) {
    if (move.from === YARD) {
      frames.push({ at, step: 0 });
      at += LEAVE_YARD_MS;
    } else {
      for (let step = move.from + 1; step <= move.to; step++) {
        frames.push({ at, step });
        at += HOP_MS;
      }
    }
    if (move.captured.length > 0) {
      at += CAPTURE_PAUSE_MS;
      frames.push({ at, step: move.to, capturedHome: true });
      at += RETURN_MS;
    }
    at += SETTLE_MS;
  } else if (roll.outcome !== "choosing") {
    at = Math.max(at, NO_MOVE_MS);
  }
  frames.push({ at });
  return frames;
}

function setStep(tokens: Record<string, TokenStep[]>, playerId: string, token: number, step: TokenStep) {
  // Players who have left no longer have tokens.
  if (tokens[playerId]) tokens[playerId][token] = step;
}

function undo(tokens: Record<string, TokenStep[]>, playerId: string, move: LudoMove) {
  setStep(tokens, playerId, move.token, move.from);
  for (const capture of move.captured) setStep(tokens, capture.playerId, capture.token, capture.from);
}

/**
 * Turns server state into an animation: each roll's dice lands, then its token hops
 * square by square, and anything it captured slides back to its yard. Rolls play
 * strictly in order.
 */
export function useMoveAnimation(state: LudoState): MoveAnimation {
  const latest = state.history[0] ?? null;
  const latestMark = latest ? playedMark(latest) : 0;
  // Rolls that existed when the board first appeared are shown as-is, not replayed.
  const [mark, setMark] = useState(latestMark);
  const [frame, setFrame] = useState<{ key: string; step: TokenStep; capturedHome: boolean } | null>(null);

  // A new game restarts the roll count.
  if (2 * state.rollCount < mark) {
    setMark(0);
    setFrame(null);
  }

  const pending = state.history.filter((roll) => playedMark(roll) > mark).sort((a, b) => a.seq - b.seq);
  const firstNeeded = Math.floor(mark / 2) + 1;
  const skip = pending.length > MAX_QUEUE || (pending.length > 0 && pending[0].seq !== firstNeeded);
  const current = skip ? null : (pending[0] ?? null);
  const showDice = current !== null && mark < rolledMark(current.seq);
  // A stable key, so refetching identical state doesn't restart the animation.
  const currentKey = current ? JSON.stringify({ roll: current, showDice }) : null;

  useEffect(() => {
    if (skip) {
      const timer = setTimeout(() => setMark(latestMark), 0);
      return () => clearTimeout(timer);
    }
    if (!currentKey) return;
    const { roll, showDice: withDice } = JSON.parse(currentKey) as { roll: LudoRoll; showDice: boolean };
    const frames = framesFor(roll, withDice);
    const timers = frames.map((f) =>
      setTimeout(() => {
        if (f.step === undefined) {
          setFrame(null);
          setMark(playedMark(roll));
        } else {
          setFrame({ key: currentKey, step: f.step, capturedHome: Boolean(f.capturedHome) });
        }
      }, f.at),
    );
    return () => timers.forEach(clearTimeout);
  }, [currentKey, skip, latestMark]);

  const tokens = Object.fromEntries(Object.entries(state.tokens).map(([id, steps]) => [id, [...steps]]));
  const live = current?.move && frame?.key === currentKey ? frame : null;
  if (!skip) {
    // Tokens with moves still to play wait where their first pending move started.
    for (const roll of [...pending].reverse()) if (roll.move) undo(tokens, roll.playerId, roll.move);
    if (current?.move && live) {
      setStep(tokens, current.playerId, current.move.token, live.step);
      if (live.capturedHome) {
        for (const capture of current.move.captured) setStep(tokens, capture.playerId, capture.token, YARD);
      }
    }
  }

  return {
    tokens,
    shownRoll: current ?? latest,
    animating: current !== null || skip,
    moving: current?.move && live && !live.capturedHome ? { playerId: current.playerId, token: current.move.token } : null,
    returning:
      current?.move && live?.capturedHome
        ? current.move.captured.map(({ playerId, token }) => ({ playerId, token }))
        : [],
  };
}
