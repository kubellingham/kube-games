import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameShell } from "@/games/components/game-shell";
import { ModeCard } from "@/games/components/mode-card";
import { formatPlayerCount, getPlayableGame } from "@/games/registry";

export async function generateMetadata({ params }: PageProps<"/games/[gameId]">): Promise<Metadata> {
  const game = getPlayableGame((await params).gameId);
  return game ? { title: game.name, description: game.tagline } : {};
}

export default async function GamePage({ params }: PageProps<"/games/[gameId]">) {
  const game = getPlayableGame((await params).gameId);
  if (!game) notFound();

  return (
    <GameShell game={game}>
      <p className="max-w-2xl text-lg text-zinc-300">{game.description}</p>
      <p className="-mt-3 text-sm text-zinc-500">
        👥 {formatPlayerCount(game.players)} · {game.category}
      </p>

      <section aria-labelledby="choose-mode" className="flex flex-col gap-4">
        <h2 id="choose-mode" className="font-display text-xl font-bold">
          Choose how to play
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {game.modes.map((mode) => (
            <ModeCard key={mode} game={game} mode={mode} />
          ))}
        </div>
      </section>

      {game.howToPlay && (
        <section aria-labelledby="how-to-play" className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
          <h2 id="how-to-play" className="font-display text-xl font-bold">
            How to play
          </h2>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-zinc-300 marker:text-fuchsia-300">
            {game.howToPlay.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      )}
    </GameShell>
  );
}
