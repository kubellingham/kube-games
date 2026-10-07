"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createLocalStore, useLocalStore } from "@/lib/local-store";
import { GameStatus } from "../../components/game-status";
import { ScoreBoard } from "../../components/score-board";
import {
  computerGameReducer,
  initialComputerGameState,
  parseStoredStats,
  totalRounds,
  type ComputerGameStats,
  type ComputerRound,
} from "../logic/computer-game";
import type { RpsMove } from "../logic/moves";
import { randomMove } from "../logic/rules";
import { MovePicker, useMoveShortcuts } from "./move-picker";
import { RoundHistory } from "./round-history";
import { RoundReveal } from "./round-reveal";

const statsStore = createLocalStore<ComputerGameStats>("kube-games:rps:vs-computer", {
  parse: (raw) => parseStoredStats(raw) ?? initialComputerGameState.stats,
  serialize: (stats) => JSON.stringify(stats),
  serverValue: initialComputerGameState.stats,
});

const HISTORY_LENGTH = 8;

export function ComputerGame() {
  const stats = useLocalStore(statsStore);
  const [lastRound, setLastRound] = useState<ComputerRound | null>(null);
  const [history, setHistory] = useState<ComputerRound[]>([]);

  const play = (playerMove: RpsMove) => {
    // Drawn without any knowledge of the player's move: randomMove takes no input.
    const computerMove = randomMove();
    const next = computerGameReducer({ stats, lastRound }, { type: "play", playerMove, computerMove });
    statsStore.set(next.stats);
    setLastRound(next.lastRound);
    setHistory((rounds) => [next.lastRound!, ...rounds].slice(0, HISTORY_LENGTH));
  };

  const resetScore = () => {
    statsStore.set(initialComputerGameState.stats);
    setLastRound(null);
    setHistory([]);
  };

  // R / P / S plays straight away, even from the result screen.
  useMoveShortcuts(play, true);

  const rounds = totalRounds(stats);
  const winRate = rounds ? Math.round((stats.wins / rounds) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <ScoreBoard
        left={{ name: "You", score: stats.wins, isYou: true, status: "Your wins" }}
        right={{ name: "Computer", score: stats.losses, status: "Computer wins" }}
        center={
          <>
            <span className="font-display text-sm font-bold text-zinc-200">
              Round {lastRound ? lastRound.round : rounds + 1}
            </span>
            <span>Draws: {stats.draws}</span>
          </>
        }
      />

      <section
        aria-label="Game"
        className="flex min-h-[24rem] flex-col justify-center gap-6 rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:p-8"
      >
        {lastRound ? (
          <RoundReveal
            key={lastRound.round}
            you={{ name: "You", move: lastRound.playerMove }}
            opponent={{ name: "Computer", move: lastRound.computerMove }}
          >
            <Button size="lg" onClick={() => setLastRound(null)} className="min-w-48">
              Play again
            </Button>
            <p className="hidden text-xs text-zinc-500 sm:block">Tip: press R, P or S to play the next round instantly.</p>
          </RoundReveal>
        ) : (
          <>
            <GameStatus icon="🤖" title={`Round ${rounds + 1} — choose your move`}>
              The computer picks at random and never sees your choice.
            </GameStatus>
            <MovePicker onPick={play} />
          </>
        )}
      </section>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <RoundHistory
          opponentName="Computer"
          rounds={history.map((r) => ({ round: r.round, you: r.playerMove, opponent: r.computerMove }))}
        />
        <div className="flex items-center gap-3 text-sm text-zinc-400 sm:ml-auto">
          {rounds > 0 && (
            <span>
              {rounds} round{rounds === 1 ? "" : "s"} · {winRate}% won
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={resetScore} disabled={rounds === 0 && !lastRound}>
            ↺ Reset score
          </Button>
        </div>
      </div>
    </div>
  );
}
