"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "../multiplayer/client/api";
import type { RoomSnapshot } from "../multiplayer/types";
import { gameRoutes } from "../routes";
import { PlayerIndicator } from "./player-indicator";
import { RoomCode } from "./room-code";

function waitingCopy(room: RoomSnapshot, seated: number, isHost: boolean) {
  if (room.isPublic) {
    return {
      title: "Finding you an opponent…",
      body: "You'll be paired with the next player who starts a quick match.",
    };
  }
  if (room.minPlayers === room.maxPlayers) {
    return {
      title: "Waiting for another player…",
      body: "Share this code with your opponent. The game starts as soon as they join.",
    };
  }
  const canStart = seated >= room.minPlayers;
  return {
    title: canStart ? (isHost ? "Ready when you are" : "Waiting for the host to start…") : "Waiting for players…",
    body: `Share this code with friends. Up to ${room.maxPlayers} can play; ${
      canStart
        ? isHost
          ? "start now, or wait for more players to join."
          : "the host can start at any time."
        : `the host can start once ${room.minPlayers} have joined.`
    }`,
  };
}

export function WaitingRoom({ room, onStart }: { room: RoomSnapshot; onStart: () => Promise<void> }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seats = Array.from({ length: room.maxPlayers }, (_, seat) =>
    room.players.find((p) => p.seat === seat && !p.hasLeft),
  );
  const seated = seats.filter(Boolean).length;
  const isHost = room.players.some((p) => p.userId === room.you.userId && p.isHost);
  const { title, body } = waitingCopy(room, seated, isHost);
  const showStart = isHost && !room.isPublic && room.minPlayers < room.maxPlayers;

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      await onStart();
    } catch (e) {
      setError(errorMessage(e));
      setStarting(false);
    }
  };

  return (
    <section
      aria-label="Waiting room"
      className="flex animate-fade-up flex-col items-center gap-8 rounded-3xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center sm:px-8 sm:py-12"
    >
      <div role="status">
        <div
          aria-hidden
          className="mx-auto mb-4 grid size-16 animate-pulse-soft place-items-center rounded-full bg-fuchsia-500/15 text-3xl"
        >
          {room.isPublic ? "⚡" : "⏳"}
        </div>
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-zinc-400">{body}</p>
      </div>

      {!room.isPublic && <RoomCode code={room.code} invitePath={gameRoutes.room(room.gameId, room.code)} />}

      <ul
        aria-label="Seats"
        className={`grid w-full gap-3 ${room.maxPlayers > 2 ? "max-w-xl grid-cols-2" : "max-w-md grid-cols-2"}`}
      >
        {seats.map((player, seat) => (
          <li key={seat} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left">
            {player ? (
              <PlayerIndicator
                name={player.displayName}
                isYou={player.userId === room.you.userId}
                status={player.isHost ? "Host · Ready" : "Ready"}
                statusTone="success"
              />
            ) : (
              <span className="flex items-center gap-2.5 text-sm text-zinc-500">
                <span className="grid size-10 animate-pulse-soft place-items-center rounded-full border-2 border-dashed border-white/15">
                  ?
                </span>
                Open seat
              </span>
            )}
          </li>
        ))}
      </ul>

      {showStart && (
        <div className="flex flex-col items-center gap-2">
          <Button size="lg" onClick={start} loading={starting} disabled={seated < room.minPlayers}>
            Start game ({seated} {seated === 1 ? "player" : "players"})
          </Button>
          {seated < room.minPlayers && (
            <p className="text-sm text-zinc-500">Needs at least {room.minPlayers} players.</p>
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
