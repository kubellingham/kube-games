"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { secureRandom } from "@/lib/random";
import { useSavedPlayerName } from "../../multiplayer/client/player-name";
import { dieValue, newGame, playRoll } from "../logic/rules";
import { TOKEN_COLORS } from "./board";
import { SnlGameView, WinnerPanel, type SnlPlayer } from "./game-view";
import { useRollAnimation } from "./use-roll-animation";

const YOU = "you";
const COMPUTERS = [
  { id: "computer-1", name: "Robo" },
  { id: "computer-2", name: "Byte" },
  { id: "computer-3", name: "Pixel" },
];

/** How long a computer player "holds" the dice before rolling. */
const COMPUTER_HOLD_MS = 900;

function LocalMatch({ computers, onChangeOpponents }: { computers: number; onChangeOpponents: () => void }) {
  const savedName = useSavedPlayerName();
  const opponents = COMPUTERS.slice(0, computers);
  const ids = [YOU, ...opponents.map((c) => c.id)];
  const [state, setState] = useState(() => newGame(ids, 0));
  const [rollingComputer, setRollingComputer] = useState<string | null>(null);
  const animation = useRollAnimation(state);

  const finished = state.winnerId !== null;
  const myTurn = state.turn === YOU && !finished;
  const canRoll = myTurn && !animation.animating;

  const players: SnlPlayer[] = [
    { id: YOU, name: savedName || "You", color: TOKEN_COLORS[0], isYou: true },
    ...opponents.map((c, i) => ({ id: c.id, name: c.name, color: TOKEN_COLORS[i + 1], isYou: false, isBot: true })),
  ];

  const rollFor = (playerId: string) =>
    setState((current) =>
      current.turn === playerId && !current.winnerId ? playRoll(current, dieValue(secureRandom), Date.now()) : current,
    );

  // Computer turns: hold the dice for a moment once the previous move has finished, then roll.
  useEffect(() => {
    const computer = state.turn;
    if (finished || animation.animating || computer === YOU) return;
    const hold = setTimeout(() => setRollingComputer(computer), 400);
    const roll = setTimeout(
      () => {
        setRollingComputer(null);
        rollFor(computer);
      },
      400 + COMPUTER_HOLD_MS + Math.random() * 500,
    );
    return () => {
      clearTimeout(hold);
      clearTimeout(roll);
    };
  }, [state.turn, state.rollCount, finished, animation.animating]);

  const turnName = players.find((p) => p.id === state.turn)?.name ?? "";
  const winner = players.find((p) => p.id === state.winnerId);

  return (
    <SnlGameView
      state={state}
      players={players}
      animation={animation}
      rollingId={rollingComputer}
      canRoll={canRoll}
      diceTitle={
        myTurn
          ? animation.animating
            ? "Moving…"
            : "Your turn: hold to roll"
          : rollingComputer
            ? `${turnName} is rolling…`
            : `${turnName}'s turn`
      }
      diceDetail={canRoll ? "Press and hold, then let go. On a keyboard, hold Space." : undefined}
      onRelease={() => rollFor(YOU)}
      finished={finished}
      finishedPanel={
        <WinnerPanel
          title={winner?.isYou ? "You win!" : `${winner?.name ?? "Someone"} wins!`}
          detail={winner?.isYou ? "First to 100. Nicely played." : "So close. Fancy a rematch?"}
        >
          <Button onClick={() => setState(newGame(ids, 0))}>Play again</Button>
          <Button variant="secondary" onClick={onChangeOpponents}>
            Change opponents
          </Button>
        </WinnerPanel>
      }
      footer={
        !finished && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setState(newGame(ids, 0))}>
              ↺ Restart
            </Button>
            <Button variant="ghost" size="sm" onClick={onChangeOpponents}>
              Change opponents
            </Button>
          </div>
        )
      }
    />
  );
}

export function ComputerGame() {
  const [computers, setComputers] = useState(1);
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return <LocalMatch key={computers} computers={computers} onChangeOpponents={() => setPlaying(false)} />;
  }

  return (
    <section className="mx-auto flex w-full max-w-md animate-fade-up flex-col gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center sm:p-8">
      <div>
        <span aria-hidden className="text-5xl">
          🎲
        </span>
        <h2 className="mt-2 font-display text-2xl font-extrabold">Play against the computer</h2>
        <p className="mt-1 text-sm text-zinc-400">How many computer opponents?</p>
      </div>
      <fieldset>
        <legend className="sr-only">Number of computer opponents</legend>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((count) => (
            <label
              key={count}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-2xl py-3 text-sm font-medium ring-1 transition ring-inset",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-white/80",
                computers === count ? "bg-white text-ink-950 ring-white" : "bg-white/[0.04] text-zinc-300 ring-white/10 hover:bg-white/10",
              )}
            >
              <input
                type="radio"
                name="computer-count"
                className="sr-only"
                checked={computers === count}
                onChange={() => setComputers(count)}
              />
              <span aria-hidden className="text-lg">
                {"🤖".repeat(count)}
              </span>
              {count} {count === 1 ? "opponent" : "opponents"}
            </label>
          ))}
        </div>
      </fieldset>
      <Button size="lg" onClick={() => setPlaying(true)}>
        Start game
      </Button>
    </section>
  );
}
