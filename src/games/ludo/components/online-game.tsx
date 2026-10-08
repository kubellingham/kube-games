"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/lib/use-now";
import { isRollingSignal, type RollSignal } from "../../components/roll-signal";
import { WinnerPanel } from "../../components/winner-panel";
import { errorMessage, isRoomApiError } from "../../multiplayer/client/api";
import { useTurnTimeoutClaim } from "../../multiplayer/client/use-turn-timeout";
import type { RoomSnapshot } from "../../multiplayer/types";
import type { OnlineGameProps } from "../../game-components";
import { TURN_TIMEOUT_MS, type LudoOptions, type LudoState } from "../logic/types";
import { LudoGameView, type LudoPlayer } from "./game-view";
import { useMoveAnimation } from "./use-move-animation";

type LudoRoom = RoomSnapshot<LudoState, null, LudoOptions>;

const COUNTDOWN_FROM_S = 10;

export function OnlineGame({ room: snapshot, act, rematch, onlineIds, signals, sendSignal, clockOffset, leave }: OnlineGameProps) {
  const room = snapshot as LudoRoom;
  const state = room.game!.state;
  const meId = room.you.userId;
  const animation = useMoveAnimation(state);
  const now = useNow(500);
  const [sending, setSending] = useState<"roll" | "move" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rematchPending, setRematchPending] = useState(false);

  const finished = room.status === "finished";
  const myTurn = state.turn === meId && !finished;
  const canRoll = myTurn && state.phase === "roll" && !animation.animating && sending === null;
  const canPick = myTurn && state.phase === "move" && !animation.animating && sending === null;
  // The deadline in this device's clock.
  const deadline = state.turnStartedAt + TURN_TIMEOUT_MS - clockOffset;

  useTurnTimeoutClaim({
    turnKey: state.step,
    deadline,
    enabled: !finished,
    claim: () => act({ type: "claim_timeout", step: state.step }),
  });

  const players: LudoPlayer[] = [...room.players]
    .sort((a, b) => a.seat - b.seat)
    .flatMap((p) =>
      state.colors[p.userId] === undefined
        ? []
        : [
            {
              id: p.userId,
              name: p.displayName,
              color: state.colors[p.userId],
              isYou: p.userId === meId,
              hasLeft: p.hasLeft,
              connection: onlineIds === null ? "unknown" : onlineIds.has(p.userId) ? "online" : "offline",
            },
          ],
    );
  const turnPlayer = players.find((p) => p.id === state.turn);

  // Another player's dice spins while their browser says they're holding it.
  const othersRolling =
    !myTurn && !finished && state.phase === "roll" && isRollingSignal(signals[state.turn], state.step, now);
  const rollingId = sending === "roll" ? meId : othersRolling ? state.turn : null;

  const secondsLeft = now === null ? null : Math.ceil((deadline - now) / 1000);
  const countdown =
    !finished && secondsLeft !== null && secondsLeft > 0 && secondsLeft <= COUNTDOWN_FROM_S
      ? `Auto-play in ${secondsLeft}s`
      : undefined;

  const send = async (kind: "roll" | "move", action: object) => {
    setSending(kind);
    setError(null);
    try {
      await act(action);
    } catch (e) {
      // If the turn timed out meanwhile, the game already played it.
      if (!(isRoomApiError(e) && e.code === "STALE_TURN")) setError(errorMessage(e));
    } finally {
      setSending(null);
    }
  };

  const onHoldStart = () => sendSignal({ kind: "holding", seq: state.step } satisfies RollSignal);

  const onRelease = () => {
    if (!myTurn || state.phase !== "roll") return;
    sendSignal({ kind: "released", seq: state.step } satisfies RollSignal);
    void send("roll", { type: "roll", step: state.step });
  };

  const onPick = (token: number) => {
    if (!canPick) return;
    void send("move", { type: "move", step: state.step, token });
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

  const active = room.players.filter((p) => !p.hasLeft);
  const votes = room.rematchVotes.length;
  const iVoted = room.rematchVotes.includes(meId);
  const winner = players.find((p) => p.id === state.winnerId);
  const turnName = turnPlayer?.name ?? "the next player";

  const diceTitle = myTurn
    ? sending === "roll"
      ? "Rolling…"
      : animation.animating
        ? "Moving…"
        : state.phase === "move"
          ? "Pick a token to move"
          : "Your turn: hold to roll"
    : othersRolling
      ? `${turnName} is rolling…`
      : state.phase === "move" && !animation.animating
        ? `${turnName} is choosing a token…`
        : `Waiting for ${turnName}…`;

  return (
    <LudoGameView
      state={state}
      players={players}
      viewerColor={state.colors[meId] ?? 0}
      animation={animation}
      rollingId={rollingId}
      canRoll={canRoll}
      canPick={canPick}
      onPick={onPick}
      diceTitle={diceTitle}
      diceDetail={
        countdown ??
        (canRoll ? "Press and hold, then let go. On a keyboard, hold Space." : canPick ? "Tap a glowing token." : undefined)
      }
      onHoldStart={onHoldStart}
      onRelease={onRelease}
      error={error}
      finished={finished}
      finishedPanel={
        room.endedReason === "player_left" ? (
          <WinnerPanel title="Everyone else left" detail="Start a new room to keep playing.">
            <Button onClick={leave}>Back to lobby</Button>
          </WinnerPanel>
        ) : (
          <WinnerPanel
            title={winner?.isYou ? "You win!" : `${winner?.name ?? "Someone"} wins!`}
            detail={
              iVoted
                ? `Waiting for the others to agree to a rematch (${votes}/${active.length}).`
                : votes > 0
                  ? `${votes} of ${active.length} want a rematch.`
                  : "First to get all four tokens home."
            }
          >
            <Button onClick={requestRematch} loading={rematchPending} disabled={iVoted || active.length < room.minPlayers}>
              {iVoted ? "Waiting…" : votes > 0 ? "Join rematch" : "Rematch"}
            </Button>
            <Button variant="secondary" onClick={leave}>
              Leave room
            </Button>
          </WinnerPanel>
        )
      }
    />
  );
}
