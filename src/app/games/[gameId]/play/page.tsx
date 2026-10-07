import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameShell } from "@/games/components/game-shell";
import { GAME_COMPONENTS } from "@/games/game-components";
import { gameSupportsMode, getPlayableGame } from "@/games/registry";

export async function generateMetadata({ params }: PageProps<"/games/[gameId]/play">): Promise<Metadata> {
  const game = getPlayableGame((await params).gameId);
  return game ? { title: `${game.name} vs Computer` } : {};
}

export default async function ComputerModePage({ params }: PageProps<"/games/[gameId]/play">) {
  const game = getPlayableGame((await params).gameId);
  const Computer = game && gameSupportsMode(game, "computer") ? GAME_COMPONENTS[game.id]?.Computer : undefined;
  if (!game || !Computer) notFound();

  return (
    <GameShell game={game} mode="computer">
      <Computer />
    </GameShell>
  );
}
