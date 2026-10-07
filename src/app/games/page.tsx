import type { Metadata } from "next";
import { FeaturedGame } from "@/games/components/featured-game";
import { GameLibrary } from "@/games/components/game-library";
import { GAMES } from "@/games/registry";

export const metadata: Metadata = {
  title: "Game Library",
  description: "Browse the Kube Games library and jump into a game solo or online.",
};

export default function GameLibraryPage() {
  const featured = GAMES.find((game) => game.availability === "available");
  const liveCount = GAMES.filter((game) => game.availability === "available").length;

  return (
    <div className="flex flex-col gap-10 pt-8 sm:gap-14 sm:pt-12">
      <section className="max-w-2xl animate-fade-up">
        <p className="text-sm font-semibold tracking-wider text-fuchsia-300 uppercase">Game Library</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
          Pick a game.{" "}
          <span className="bg-linear-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
            Play in seconds.
          </span>
        </h1>
        <p className="mt-4 text-lg text-zinc-400">
          Warm up against the computer or challenge a friend online with a room code. No sign-up needed.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2 text-sm text-zinc-300">
          <li className="rounded-full bg-white/[0.05] px-3 py-1 ring-1 ring-white/10">
            🎮 {liveCount} {liveCount === 1 ? "game" : "games"} live
          </li>
          <li className="rounded-full bg-white/[0.05] px-3 py-1 ring-1 ring-white/10">🌐 Real-time multiplayer</li>
          <li className="rounded-full bg-white/[0.05] px-3 py-1 ring-1 ring-white/10">📱 Works on any device</li>
        </ul>
      </section>

      {featured && <FeaturedGame game={featured} />}

      <section aria-labelledby="all-games" className="flex flex-col gap-6">
        <h2 id="all-games" className="font-display text-2xl font-bold">
          All games
        </h2>
        <GameLibrary games={GAMES} />
      </section>
    </div>
  );
}
