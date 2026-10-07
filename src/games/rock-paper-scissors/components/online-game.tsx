"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "../../multiplayer/client/api";
import type { RoomSnapshot } from "../../multiplayer/types";
import { GameStatus } from "../../components/game-status";
import { ScoreBoard, type ScoreSide } from "../../components/score-board";
import type { OnlineGameProps } from "../../game-components";
import { MOVE_DETAILS, type RpsMove } from "../logic/moves";
import type { RpsOptions, RpsSecret, RpsState } from "../multiplayer/types";
import { MovePicker, useMoveShortcuts } from "./move-picker";
import { RoundHistory } from "./round-history";
import { RoundReveal } from "./round-reveal";

type RpsRoom = RoomSnapshot<RpsState, RpsSecret, RpsOptions>;

export function OnlineGame({ room: snapshot, act, rematch, onlineIds, leave }: OnlineGameProps) {
  const room = snapshot as RpsRoom;
  const state = room.game!.state;
  const secret = room.game!.secret;
  const meId = room.you.userId;
  const me = room.players.find((p) => p.userId === meId)!;
  const opponent = room.players.find((p) => p.userId !== meId);
  const opponentName = opponent?.displayName ?? "Opponent";
  const latest = state.history[0] ?? null;

  // Which revealed round this player has dismissed with "Next round".
  const [seenRound, setSeenRound] = useState(latest?.round ?? 0);
  // A rematch starts a fresh match with an empty history.
  if (state.history.length === 0 && seenRound !== 0) setSeenRound(0);

  const [pendingMove, setPendingMove] = useState<RpsMove | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rematchPending, setRematchPending] = useState(false);

  const finished = room.status === "finished";
  const opponentLeft = room.endedReason === "player_left" || Boolean(opponent?.hasLeft);
  const iLockedIn = state.lockedIn.includes(meId);
  const opponentLockedIn = opponent ? state.lockedIn.includes(opponent.userId) : false;
  const myMove = secret?.round === state.round ? secret.move : null;
  const showReveal = latest !== null && (finished || latest.round !== seenRound);

  const view = opponentLeft
    ? "opponent-left"
    : finished
      ? "match-over"
      : showReveal
        ? "reveal"
        : iLockedIn
          ? "waiting"
          : "choose";

  const submit = async (move: RpsMove) => {
    if (pendingMove || iLockedIn || finished) return;
    if (latest) setSeenRound(latest.round);
    setPendingMove(move);
    setError(null);
    try {
      await act({ type: "submit_move", round: state.round, move });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPendingMove(null);
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

  useMoveShortcuts(submit, view === "choose" || view === "reveal");

  const connection = (userId: string) =>
    onlineIds === null ? "unknown" : onlineIds.has(userId) ? "online" : "offline";

  const meSide: ScoreSide = {
    name: me.displayName,
    score: state.scores[meId] ?? 0,
    isYou: true,
    status: view === "waiting" ? "Locked in 🔒" : view === "choose" ? "Choosing…" : undefined,
    statusTone: view === "waiting" ? "success" : "neutral",
  };
  const opponentSide: ScoreSide = {
    name: opponentName,
    score: opponent ? (state.scores[opponent.userId] ?? 0) : 0,
    connection: opponent ? connection(opponent.userId) : "unknown",
    ...(opponentLeft
      ? { status: "Left the game", statusTone: "warning" as const }
      : finished
        ? {}
        : opponentLockedIn
          ? { status: view === "reveal" ? "Ready for next round" : "Locked in 🔒", statusTone: "success" as const }
          : view === "reveal"
            ? {}
            : { status: "Choosing…" }),
  };

  const iVoted = room.rematchVotes.includes(meId);
  const opponentVoted = opponent ? room.rematchVotes.includes(opponent.userId) : false;
  const iWonMatch = state.matchWinnerId === meId;

  return (
    <div className="flex flex-col gap-5">
      <ScoreBoard
        left={meSide}
        right={opponentSide}
        center={
          <>
            <span className="font-display text-sm font-bold text-zinc-200">
              Round {view === "reveal" || finished ? (latest?.round ?? state.round) : state.round}
            </span>
            <span>{room.options.targetScore ? `First to ${room.options.targetScore}` : "Endless"}</span>
            <span>Draws: {state.draws}</span>
          </>
        }
      />

      <section
        aria-label="Game"
        className="flex min-h-[24rem] flex-col justify-center gap-6 rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:p-8"
      >
        {view === "choose" && (
          <>
            <GameStatus icon={opponentLockedIn ? "⏱️" : "👉"} title="Your turn">
              {opponentLockedIn ? `${opponentName} has locked in. Choose your move!` : "Choose your move."}
            </GameStatus>
            <MovePicker onPick={submit} disabled={pendingMove !== null} pendingMove={pendingMove} />
          </>
        )}

        {view === "waiting" && (
          <div className="flex flex-col items-center gap-6 text-center" data-testid="waiting-for-opponent">
            <div className="grid w-full max-w-xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">You</p>
                <div className="grid aspect-square w-full max-w-44 animate-pop-in place-items-center rounded-3xl border border-fuchsia-400/40 bg-fuchsia-500/10 text-6xl sm:text-8xl">
                  <span aria-hidden>{myMove ? MOVE_DETAILS[myMove].emoji : "🔒"}</span>
                </div>
              </div>
              <span aria-hidden className="font-display text-lg font-black text-zinc-500">
                VS
              </span>
              <div className="flex flex-col items-center gap-2">
                <p className="max-w-full truncate text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                  {opponentName}
                </p>
                <div className="grid aspect-square w-full max-w-44 animate-pulse-soft place-items-center rounded-3xl border border-dashed border-white/20 bg-white/[0.03] text-5xl sm:text-7xl">
                  <span aria-hidden>{opponentLockedIn ? "🔒" : "🤔"}</span>
                </div>
              </div>
            </div>
            <GameStatus icon="🔒" title={myMove ? `You chose ${MOVE_DETAILS[myMove].label}.` : "Move locked in."}>
              Choice locked in. Waiting for {opponentName}…
            </GameStatus>
          </div>
        )}

        {(view === "reveal" || view === "match-over") && latest && opponent && (
          <RoundReveal
            key={latest.round}
            you={{ name: "You", move: latest.moves[meId] }}
            opponent={{ name: opponentName, move: latest.moves[opponent.userId] }}
          >
            {view === "reveal" ? (
              <>
                <Button size="lg" className="min-w-48" onClick={() => setSeenRound(latest.round)}>
                  Next round
                </Button>
                {opponentLockedIn && (
                  <p className="text-sm text-zinc-400">{opponentName} has already locked in the next round.</p>
                )}
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-center">
                  <p className="font-display text-2xl font-extrabold">
                    {iWonMatch ? "🏆 You won the match!" : `${opponentName} won the match`}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Final score {meSide.score} – {opponentSide.score}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button size="lg" onClick={requestRematch} loading={rematchPending} disabled={iVoted}>
                    {iVoted ? "Waiting for opponent…" : opponentVoted ? "Accept rematch" : "Rematch"}
                  </Button>
                  <Button size="lg" variant="secondary" onClick={leave}>
                    Leave room
                  </Button>
                </div>
                {opponentVoted && !iVoted && (
                  <p className="text-sm text-fuchsia-200" role="status">
                    {opponentName} wants a rematch!
                  </p>
                )}
              </>
            )}
          </RoundReveal>
        )}

        {view === "opponent-left" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <span aria-hidden className="text-6xl">
              👋
            </span>
            <div>
              <h2 className="font-display text-2xl font-extrabold">{opponentName} left the game</h2>
              <p className="mt-1 text-zinc-400">
                Final score {meSide.score} – {opponentSide.score}. Start a new room to keep playing.
              </p>
            </div>
            <Button size="lg" onClick={leave}>
              Back to lobby
            </Button>
          </div>
        )}

        {error && (
          <GameStatus tone="danger" icon="⚠️" title="That didn't work">
            {error}
          </GameStatus>
        )}
      </section>

      {opponent && (
        <RoundHistory
          opponentName={opponentName}
          rounds={state.history.map((h) => ({ round: h.round, you: h.moves[meId], opponent: h.moves[opponent.userId] }))}
        />
      )}
    </div>
  );
}
