import type { RoomSnapshot } from "../multiplayer/types";
import { gameRoutes } from "../routes";
import { PlayerIndicator } from "./player-indicator";
import { RoomCode } from "./room-code";

export function WaitingRoom({ room }: { room: RoomSnapshot }) {
  const seats = Array.from({ length: room.maxPlayers }, (_, seat) =>
    room.players.find((p) => p.seat === seat && !p.hasLeft),
  );

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
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
          {room.isPublic ? "Finding you an opponent…" : "Waiting for another player…"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-zinc-400">
          {room.isPublic
            ? "You'll be paired with the next player who starts a quick match."
            : "Share this code with your opponent. The game starts as soon as they join."}
        </p>
      </div>

      {!room.isPublic && <RoomCode code={room.code} invitePath={gameRoutes.room(room.gameId, room.code)} />}

      <ul aria-label="Seats" className="grid w-full max-w-md grid-cols-2 gap-3">
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
    </section>
  );
}
