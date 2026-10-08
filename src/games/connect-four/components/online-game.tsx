"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/lib/use-now";
import { GameStatus } from "../../components/game-status";
import { PlayerIndicator } from "../../components/player-indicator";
import { errorMessage, isRoomApiError } from "../../multiplayer/client/api";
import type { RoomSnapshot } from "../../multiplayer/types";
import type { OnlineGameProps } from "../../game-components";
import { discOf, isGameOver } from "../logic/rules";
import type { C4Options, C4State, Disc } from "../logic/types";
import { C4Board, DiscFace } from "./board";

type C4Room = RoomSnapshot<C4State, null, C4Options>;

/** Where a player is aiming, broadcast while they hover over the board. Cosmetic only. */
type AimSignal = { kind: "aim"; column: number | null; seq: number };

/** An aim signal older than this is ignored (the player has probably wandered off). */
const AIM_FRESH_MS = 10_000;

const DISC_NAMES: Record<Disc, string> = { red: "Red", yellow: "Yellow" };

export function OnlineGame({ room: snapshot, act, rematch, onlineIds, signals, sendSignal, leave }: OnlineGameProps) {
  const room = snapshot as C4Room;
  const state = room.game!.state;
  const meId = room.you.userId;
  const me = room.players.find((p) => p.userId === meId)!;
  const opponent = room.players.find((p) => p.userId !== meId);
  const opponentName = opponent?.displayName ?? "Opponent";
  const myDisc = discOf(state, meId);
  const opponentDisc: Disc = myDisc === "red" ? "yellow" : "red";
  const now = useNow(1000);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rematchPending, setRematchPending] = useState(false);

  const over = isGameOver(state);
  const opponentLeft = room.endedReason === "player_left" || Boolean(opponent?.hasLeft);
  const myTurn = state.turn === meId && !over && room.status === "playing";
  const canDrop = myTurn && !sending;

  const drop = async (column: number) => {
    setSending(true);
    setError(null);
    try {
      await act({ type: "drop", column, seq: state.moveCount });
    } catch (e) {
      // A repeated tap for a move that already landed isn't worth an error.
      if (!(isRoomApiError(e) && e.code === "STALE_MOVE")) setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const requestRematch = async () => {
    setRematchPending(true);
    setError(null);
    try {
      await rematch();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRematchPending(false);
    }
  };

  // The opponent's aim shows faintly over the board while it's their move.
  const aim = opponent ? signals[opponent.userId] : undefined;
  const aimData = aim?.data as AimSignal | undefined;
  const ghost =
    opponent &&
    state.turn === opponent.userId &&
    !over &&
    aim &&
    aimData?.kind === "aim" &&
    aimData.seq === state.moveCount &&
    aimData.column !== null &&
    now !== null &&
    now - aim.receivedAt < AIM_FRESH_MS
      ? { column: aimData.column, disc: opponentDisc }
      : null;

  const connection = (userId: string) =>
    onlineIds === null ? "unknown" : onlineIds.has(userId) ? "online" : "offline";

  const iVoted = room.rematchVotes.includes(meId);
  const opponentVoted = opponent ? room.rematchVotes.includes(opponent.userId) : false;

  const status = over
    ? state.draw
      ? "It's a draw"
      : state.winnerId === meId
        ? "You win!"
        : `${opponentName} wins`
    : myTurn
      ? "Your turn"
      : `Waiting for ${opponentName}…`;

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Players"
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <DiscFace disc={myDisc} className="size-7 shrink-0" />
          <PlayerIndicator
            name={me.displayName}
            isYou
            status={over ? undefined : myTurn ? "Your move" : DISC_NAMES[myDisc]}
            statusTone={myTurn ? "success" : "neutral"}
          />
        </div>
        <span className="font-display text-sm font-bold text-zinc-500">vs</span>
        <div className="flex min-w-0 items-center justify-end gap-3">
          <PlayerIndicator
            name={opponentName}
            align="right"
            connection={opponent ? connection(opponent.userId) : "unknown"}
            status={
              opponentLeft
                ? "Left the game"
                : !over && opponent && state.turn === opponent.userId
                  ? "Their move"
                  : DISC_NAMES[opponentDisc]
            }
            statusTone={opponentLeft ? "warning" : "neutral"}
          />
          <DiscFace disc={opponentDisc} className="size-7 shrink-0" />
        </div>
      </section>

      <section
        aria-label="Game"
        className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-3 sm:p-6"
      >
        {opponentLeft ? (
          <div className="flex min-h-[20rem] flex-col items-center justify-center gap-4 text-center">
            <span aria-hidden className="text-6xl">
              👋
            </span>
            <div>
              <h2 className="font-display text-2xl font-extrabold">{opponentName} left the game</h2>
              <p className="mt-1 text-zinc-400">Start a new room to keep playing.</p>
            </div>
            <Button size="lg" onClick={leave}>
              Back to lobby
            </Button>
          </div>
        ) : (
          <>
            <C4Board
              board={state.board}
              playerDisc={myDisc}
              canDrop={canDrop}
              onDrop={drop}
              lastMove={state.lastMove}
              moveCount={state.moveCount}
              winningCells={state.winningCells}
              ghost={ghost}
              onAimChange={(column) => {
                if (myTurn) sendSignal({ kind: "aim", column, seq: state.moveCount } satisfies AimSignal);
              }}
              status={status}
              statusDisc={over ? (state.winnerId ? discOf(state, state.winnerId) : null) : discOf(state, state.turn)}
              statusDetail={
                over
                  ? undefined
                  : state.moveCount === 0
                    ? state.firstPlayerId === meId
                      ? `You go first. You're ${DISC_NAMES[myDisc]}.`
                      : `${opponentName} goes first. You're ${DISC_NAMES[myDisc]}.`
                    : `You're ${DISC_NAMES[myDisc]}.`
              }
            />

            {over && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-wrap justify-center gap-3">
                  <Button size="lg" onClick={requestRematch} loading={rematchPending} disabled={iVoted}>
                    {iVoted ? "Waiting for opponent…" : opponentVoted ? "Accept rematch" : "Rematch"}
                  </Button>
                  <Button size="lg" variant="secondary" onClick={leave}>
                    Leave room
                  </Button>
                </div>
                {opponentVoted && !iVoted && (
                  <p className="text-sm text-amber-200" role="status">
                    {opponentName} wants a rematch!
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {error && (
          <GameStatus tone="danger" icon="⚠️" title="That didn't work">
            {error}
          </GameStatus>
        )}
      </section>
    </div>
  );
}
