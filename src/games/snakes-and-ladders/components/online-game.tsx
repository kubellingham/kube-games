"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/lib/use-now";
import { errorMessage, isRoomApiError } from "../../multiplayer/client/api";
import type { RoomSnapshot } from "../../multiplayer/types";
import type { OnlineGameProps } from "../../game-components";
import { MAX_HOLD_MS, TURN_TIMEOUT_MS, type SnlOptions, type SnlState } from "../logic/types";
import { TOKEN_COLORS } from "./board";
import { SnlGameView, WinnerPanel, type SnlPlayer } from "./game-view";
import { useRollAnimation } from "./use-roll-animation";

type SnlRoom = RoomSnapshot<SnlState, null, SnlOptions>;

/** What a player's browser broadcasts while rolling. Cosmetic only. */
type RollSignal = { kind: "holding" | "released"; seq: number };

const COUNTDOWN_FROM_S = 10;

/** Errors meaning a timeout claim is no longer needed. */
const GIVE_UP_CLAIM = new Set(["STALE_TURN", "MATCH_OVER", "GAME_NOT_ACTIVE", "NOT_A_PLAYER", "NOT_IN_ROOM"]);

export function OnlineGame({ room: snapshot, act, rematch, onlineIds, signals, sendSignal, clockOffset, leave }: OnlineGameProps) {
  const room = snapshot as SnlRoom;
  const state = room.game!.state;
  const meId = room.you.userId;
  const animation = useRollAnimation(state);
  const now = useNow(500);
  const [rollingSeq, setRollingSeq] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rematchPending, setRematchPending] = useState(false);

  const finished = room.status === "finished";
  const myTurn = state.turn === meId && !finished;
  const canRoll = myTurn && !animation.animating && rollingSeq === null;
  // The deadline in this device's clock.
  const deadline = state.turnStartedAt + TURN_TIMEOUT_MS - clockOffset;

  // When a turn runs out of time, every player's browser asks the server to roll for the
  // absent player. The server checks the deadline itself and accepts only the first claim.
  useEffect(() => {
    if (finished) return;
    const seq = state.rollCount;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const claim = () => {
      act({ type: "claim_timeout", seq }).catch((e) => {
        // Someone else's claim (or the player's own roll) won: the refreshed room moves the turn on.
        if (cancelled || (isRoomApiError(e) && GIVE_UP_CLAIM.has(e.code))) return;
        // Otherwise (a network blip, or our clock running a little fast) try again shortly.
        timer = setTimeout(claim, 3_000 + Math.random() * 2_000);
      });
    };
    timer = setTimeout(claim, Math.max(0, deadline - Date.now()) + 300 + Math.random() * 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deadline, state.rollCount, finished, act]);

  const players: SnlPlayer[] = room.players.map((p) => ({
    id: p.userId,
    name: p.displayName,
    color: TOKEN_COLORS[p.seat % TOKEN_COLORS.length],
    isYou: p.userId === meId,
    hasLeft: p.hasLeft,
    connection: onlineIds === null ? "unknown" : onlineIds.has(p.userId) ? "online" : "offline",
  }));
  const turnPlayer = players.find((p) => p.id === state.turn);

  // Another player's dice spins while their browser says they're holding it.
  const signal = signals[state.turn];
  const signalData = signal?.data as RollSignal | undefined;
  const signalAge = now !== null && signal ? now - signal.receivedAt : Infinity;
  const othersRolling =
    !myTurn &&
    !finished &&
    signalData?.seq === state.rollCount &&
    ((signalData.kind === "holding" && signalAge < MAX_HOLD_MS + 2_000) ||
      (signalData.kind === "released" && signalAge < 3_000));
  const rollingId = rollingSeq !== null ? meId : othersRolling ? state.turn : null;

  const secondsLeft = now === null ? null : Math.ceil((deadline - now) / 1000);
  const countdown =
    !finished && secondsLeft !== null && secondsLeft > 0 && secondsLeft <= COUNTDOWN_FROM_S
      ? `Auto-roll in ${secondsLeft}s`
      : undefined;

  const onHoldStart = () => sendSignal({ kind: "holding", seq: state.rollCount } satisfies RollSignal);

  const onRelease = async () => {
    if (state.turn !== meId || finished) return;
    const seq = state.rollCount;
    sendSignal({ kind: "released", seq } satisfies RollSignal);
    setRollingSeq(seq);
    setError(null);
    try {
      await act({ type: "roll", seq });
    } catch (e) {
      // If the turn timed out while the dice was held, the game already rolled for you.
      if (!(isRoomApiError(e) && e.code === "STALE_TURN")) setError(errorMessage(e));
    } finally {
      setRollingSeq(null);
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

  const active = room.players.filter((p) => !p.hasLeft);
  const votes = room.rematchVotes.length;
  const iVoted = room.rematchVotes.includes(meId);
  const winner = players.find((p) => p.id === state.winnerId);

  const diceTitle = myTurn
    ? rollingSeq !== null
      ? "Rolling…"
      : animation.animating
        ? "Moving…"
        : "Your turn: hold to roll"
    : othersRolling
      ? `${turnPlayer?.name ?? "Someone"} is rolling…`
      : `Waiting for ${turnPlayer?.name ?? "the next player"}…`;

  return (
    <SnlGameView
      state={state}
      players={players}
      animation={animation}
      rollingId={rollingId}
      canRoll={canRoll}
      diceTitle={diceTitle}
      diceDetail={countdown ?? (canRoll ? "Press and hold, then let go. On a keyboard, hold Space." : undefined)}
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
                  : "First to land on 100."
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
