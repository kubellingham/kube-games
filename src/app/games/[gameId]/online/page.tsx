import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GameLoading } from "@/games/components/game-loading";
import { GameShell } from "@/games/components/game-shell";
import { MultiplayerLobby } from "@/games/components/multiplayer-lobby";
import { gameSupportsMode, getPlayableGame } from "@/games/registry";

export async function generateMetadata({ params }: PageProps<"/games/[gameId]/online">): Promise<Metadata> {
  const game = getPlayableGame((await params).gameId);
  return game ? { title: `${game.name} Online` } : {};
}

export default async function OnlineLobbyPage({ params }: PageProps<"/games/[gameId]/online">) {
  const game = getPlayableGame((await params).gameId);
  if (!game || !gameSupportsMode(game, "online")) notFound();

  return (
    <GameShell game={game} mode="online">
      {/* The lobby reads ?code= from the URL, which is only known at request time. */}
      <Suspense fallback={<GameLoading label="Loading lobby…" />}>
        <MultiplayerLobby game={game} />
      </Suspense>
    </GameShell>
  );
}
