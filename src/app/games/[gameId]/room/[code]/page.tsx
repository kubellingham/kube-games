import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GameLoading } from "@/games/components/game-loading";
import { GameShell } from "@/games/components/game-shell";
import { RoomScreen } from "@/games/components/room-screen";
import { normalizeRoomCode } from "@/games/multiplayer/rules";
import { gameSupportsMode, getPlayableGame } from "@/games/registry";

export const metadata: Metadata = { title: "Online room" };

type Params = PageProps<"/games/[gameId]/room/[code]">["params"];

async function Room({ params }: { params: Params }) {
  const { gameId, code } = await params;
  const game = getPlayableGame(gameId);
  if (!game || !gameSupportsMode(game, "online")) notFound();
  const roomCode = normalizeRoomCode(code);

  return (
    <GameShell game={game} mode="online" showModeSwitch={false}>
      <RoomScreen key={roomCode} game={game} code={roomCode} />
    </GameShell>
  );
}

export default function RoomPage({ params }: PageProps<"/games/[gameId]/room/[code]">) {
  // Room codes are only known at request time, so the room streams in behind a fallback.
  return (
    <Suspense
      fallback={
        <div className="pt-8">
          <GameLoading label="Connecting to room…" />
        </div>
      }
    >
      <Room params={params} />
    </Suspense>
  );
}
