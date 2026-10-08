"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { createLocalStore, useLocalStore } from "@/lib/local-store";
import { ScoreBoard } from "../../components/score-board";
import { chooseComputerMove, DIFFICULTIES, isDifficulty, type Difficulty } from "../logic/ai";
import { discOf, isGameOver, newGame, playDrop } from "../logic/rules";
import { EMPTY_STATS, gamesPlayed, parseStats, recordOutcome, type C4Stats } from "../logic/stats";
import type { C4State } from "../logic/types";
import { C4Board } from "./board";

const YOU = "you";
const COMPUTER = "computer";

const statsStore = createLocalStore<C4Stats>("kube-games:connect-four:vs-computer", {
  parse: parseStats,
  serialize: (stats) => JSON.stringify(stats),
  serverValue: EMPTY_STATS,
});

const difficultyStore = createLocalStore<Difficulty>("kube-games:connect-four:difficulty", {
  parse: (raw) => (isDifficulty(raw) ? raw : "medium"),
  serialize: (difficulty) => difficulty,
  serverValue: "medium",
});

const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** How long the computer "thinks" before dropping, so its move is easy to follow. */
const THINK_MS = 450;

export function ComputerGame() {
  const stats = useLocalStore(statsStore);
  const difficulty = useLocalStore(difficultyStore);
  // You go first in the first game; after that, whoever didn't start last time does.
  const [state, setState] = useState<C4State>(() => newGame([YOU, COMPUTER], YOU));

  const over = isGameOver(state);
  const yourTurn = state.turn === YOU && !over;

  const play = (column: number) => {
    const next = playDrop(state, column);
    setState(next);
    if (isGameOver(next)) {
      statsStore.set(recordOutcome(stats, next.draw ? "draw" : next.winnerId === YOU ? "win" : "loss"));
    }
  };

  const computerMove = useEffectEvent(() => play(chooseComputerMove(state.board, discOf(state, COMPUTER), difficulty)));

  // The computer's move: think briefly, then search for the best column.
  useEffect(() => {
    if (over || state.turn !== COMPUTER) return;
    const timer = setTimeout(computerMove, THINK_MS + Math.random() * 300);
    return () => clearTimeout(timer);
  }, [state, over]);

  const playAgain = () => setState(newGame([YOU, COMPUTER], state.firstPlayerId === YOU ? COMPUTER : YOU));

  const status = over
    ? state.draw
      ? "It's a draw"
      : state.winnerId === YOU
        ? "You win!"
        : "Computer wins"
    : yourTurn
      ? "Your turn"
      : "Computer is thinking…";

  return (
    <div className="flex flex-col gap-5">
      <ScoreBoard
        left={{ name: "You", score: stats.wins, isYou: true, status: "Red · your wins" }}
        right={{ name: "Computer", score: stats.losses, status: "Yellow · its wins" }}
        center={
          <>
            <span className="font-display text-sm font-bold text-zinc-200">{DIFFICULTY_LABELS[difficulty]}</span>
            <span>Draws: {stats.draws}</span>
          </>
        }
      />

      <section
        aria-label="Game"
        className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-3 sm:p-6"
      >
        <C4Board
          board={state.board}
          playerDisc="red"
          canDrop={yourTurn}
          onDrop={play}
          lastMove={state.lastMove}
          moveCount={state.moveCount}
          winningCells={state.winningCells}
          status={status}
          statusDisc={over ? (state.winnerId ? discOf(state, state.winnerId) : null) : discOf(state, state.turn)}
          statusDetail={
            over
              ? undefined
              : state.moveCount === 0
                ? state.firstPlayerId === YOU
                  ? "You go first."
                  : "The computer goes first this time."
                : "Connect four of your red discs in a row."
          }
        />
        {over && (
          <div className="flex justify-center">
            <Button size="lg" onClick={playAgain}>
              Play again
            </Button>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Difficulty</legend>
          {DIFFICULTIES.map((level) => (
            <label
              key={level}
              className={cn(
                "cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ring-inset",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-white/80",
                difficulty === level
                  ? "bg-white text-ink-950 ring-white"
                  : "bg-white/[0.04] text-zinc-300 ring-white/10 hover:bg-white/10",
              )}
            >
              <input
                type="radio"
                name="difficulty"
                className="sr-only"
                checked={difficulty === level}
                onChange={() => difficultyStore.set(level)}
              />
              {DIFFICULTY_LABELS[level]}
            </label>
          ))}
        </fieldset>
        {gamesPlayed(stats) > 0 && (
          <Button variant="ghost" size="sm" onClick={() => statsStore.set(EMPTY_STATS)}>
            ↺ Reset score
          </Button>
        )}
      </div>
    </div>
  );
}
