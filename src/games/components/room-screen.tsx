"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { cn } from "@/lib/cn";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useDelayedFlag } from "@/lib/use-delayed-flag";
import { GAME_COMPONENTS } from "../game-components";
import { useGameRoom, type ConnectionStatus } from "../multiplayer/client/use-game-room";
import type { RoomStatus } from "../multiplayer/types";
import { getGame } from "../registry";
import { gameRoutes } from "../routes";
import type { GameDefinition } from "../types";
import { GameLoading } from "./game-loading";
import { GameStatus } from "./game-status";
import { JoinRoomPrompt } from "./join-room-prompt";
import { RoomCodeChip } from "./room-code";
import { RoomError } from "./room-error";
import { WaitingRoom } from "./waiting-room";

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  live: "Live",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
};

function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-zinc-400" data-testid="connection-status">
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          status === "live" ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/80" : "animate-pulse-soft bg-amber-400",
        )}
      />
      {CONNECTION_LABEL[status]}
    </span>
  );
}

function LeaveControl({ status, leaving, onLeave }: { status: RoomStatus; leaving: boolean; onLeave: () => void }) {
  const [confirming, setConfirming] = useState(false);
  // Don't come back to an open confirmation after navigating away and back.
  useLayoutEffect(() => () => setConfirming(false), []);

  if (status === "finished") {
    return (
      <Button variant="secondary" size="sm" onClick={onLeave} loading={leaving}>
        Back to lobby
      </Button>
    );
  }
  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        {status === "waiting" ? "Cancel room" : "Leave game"}
      </Button>
    );
  }
  return (
    <div
      role="group"
      aria-label="Confirm leaving"
      className="flex animate-fade-up items-center gap-1.5 rounded-2xl bg-rose-500/10 p-1 pl-3 ring-1 ring-rose-400/30"
    >
      <span className="text-sm text-rose-100">{status === "waiting" ? "Close this room?" : "End the match?"}</span>
      <Button variant="danger" size="sm" onClick={onLeave} loading={leaving}>
        Leave
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Stay
      </Button>
    </div>
  );
}

/** Generic online room: connection, waiting room, join prompt and errors; the game renders inside. */
export function RoomScreen({ game, code }: { game: GameDefinition; code: string }) {
  const router = useRouter();
  const { load, connection, onlineIds, refresh, join, act, rematch, leave } = useGameRoom(code);
  const [leaving, setLeaving] = useState(false);
  const lobbyHref = gameRoutes.online(game.id);

  const room = load.phase === "ready" ? load.room : null;

  // Announce the opponent's arrival to players who were in the waiting room.
  const [sawWaitingRoom, setSawWaitingRoom] = useState(false);
  if (room?.status === "waiting" && !sawWaitingRoom) setSawWaitingRoom(true);
  if (room?.status === "finished" && sawWaitingRoom) setSawWaitingRoom(false);
  const justStarted = sawWaitingRoom && room?.status === "playing";
  const joinNoticeExpired = useDelayedFlag(justStarted, 6_000);

  const awayPlayers =
    room?.status === "playing" && onlineIds
      ? room.players.filter((p) => p.userId !== room.you.userId && !p.hasLeft && !onlineIds.has(p.userId))
      : [];
  const opponentAway = useDelayedFlag(awayPlayers.length > 0, 4_000);

  const exitRoom = async () => {
    setLeaving(true);
    try {
      await leave();
    } catch {
      // Nothing more to do: an abandoned room is cleaned up once our heartbeats stop.
    }
    setLeaving(false);
    router.push(lobbyHref);
  };

  if (!isSupabaseConfigured) {
    return (
      <StatePanel icon="🛠️" title="Online play isn't set up yet" actions={<ButtonLink href={gameRoutes.game(game.id)}>Back</ButtonLink>}>
        Add your Supabase project settings to the environment to enable online multiplayer.
      </StatePanel>
    );
  }
  if (load.phase === "loading") return <GameLoading label={`Connecting to room ${code}…`} />;
  if (load.phase === "error") return <RoomError error={load.error} lobbyHref={lobbyHref} onRetry={refresh} />;
  if (load.phase === "join") {
    return <JoinRoomPrompt game={game} code={code} preview={load.preview} lobbyHref={lobbyHref} onJoin={join} />;
  }

  const { room: snapshot } = load;
  if (snapshot.gameId !== game.id) {
    const actualGame = getGame(snapshot.gameId);
    return (
      <StatePanel
        icon="🔀"
        title={`This room is for ${actualGame?.name ?? "another game"}`}
        actions={<ButtonLink href={gameRoutes.room(snapshot.gameId, snapshot.code)}>Go to the room</ButtonLink>}
      />
    );
  }
  if (snapshot.players.some((p) => p.userId === snapshot.you.userId && p.hasLeft)) {
    return (
      <StatePanel icon="🚪" title="You left this game" actions={<ButtonLink href={lobbyHref}>Back to lobby</ButtonLink>}>
        Start a new room to play again.
      </StatePanel>
    );
  }

  const Online = GAME_COMPONENTS[game.id]?.Online;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <RoomCodeChip code={snapshot.code} />
          <ConnectionIndicator status={connection} />
        </div>
        <LeaveControl status={snapshot.status} leaving={leaving} onLeave={exitRoom} />
      </div>

      {justStarted && !joinNoticeExpired && (
        <GameStatus tone="success" icon="🎉" title="Opponent joined!">
          {snapshot.players.find((p) => p.userId !== snapshot.you.userId)?.displayName ?? "Your opponent"} is here.
          Game on!
        </GameStatus>
      )}
      {connection === "reconnecting" && (
        <GameStatus tone="warning" icon="🔄" title="Reconnecting…">
          Your game is safe on the server. We&apos;ll catch up as soon as the connection is back.
        </GameStatus>
      )}
      {opponentAway && (
        <GameStatus tone="warning" icon="📡" title="Opponent disconnected">
          Waiting for them to reconnect. You can keep waiting or leave the game.
        </GameStatus>
      )}

      {snapshot.status === "waiting" || !snapshot.game ? (
        <WaitingRoom room={snapshot} />
      ) : Online ? (
        <Online room={snapshot} act={act} rematch={rematch} onlineIds={onlineIds} leave={exitRoom} />
      ) : (
        <StatePanel icon="🚧" title="Online play isn't available for this game yet" />
      )}
    </div>
  );
}
