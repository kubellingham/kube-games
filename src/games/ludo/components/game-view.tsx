"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { HoldDicePad } from "../../components/hold-dice";
import type { Connection } from "../../components/player-indicator";
import { cellOf, COLOR_HEX } from "../logic/board";
import { describeRoll } from "../logic/describe-roll";
import { targetStep } from "../logic/rules";
import { HOME, type LudoColor, type LudoState } from "../logic/types";
import { LudoBoard, type BoardToken } from "./board";
import type { MoveAnimation } from "./use-move-animation";

export interface LudoPlayer {
  id: string;
  name: string;
  color: LudoColor;
  isYou: boolean;
  isBot?: boolean;
  connection?: Connection;
  hasLeft?: boolean;
}

function PlayersPanel({
  players,
  state,
  tokens,
  rollingId,
}: {
  players: LudoPlayer[];
  state: LudoState;
  tokens: MoveAnimation["tokens"];
  rollingId: string | null;
}) {
  return (
    <section aria-label="Players" className="rounded-3xl border border-white/10 bg-white/[0.03] p-3">
      <ul className="flex flex-col gap-1">
        {players.map((player) => {
          const isTurn = !state.winnerId && state.turn === player.id && !player.hasLeft;
          const steps = tokens[player.id] ?? [];
          const home = steps.filter((step) => step === HOME).length;
          // Overall progress: every token's steps out of the whole journey.
          const progress = steps.reduce((sum, step) => sum + Math.max(0, step + 1), 0) / (4 * (HOME + 1));
          return (
            <li
              key={player.id}
              data-testid={`player-${player.id}`}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2 transition",
                isTurn && "bg-white/[0.06] ring-1 ring-white/15",
                player.hasLeft && "opacity-45",
              )}
            >
              <span
                className="relative grid size-8 shrink-0 place-items-center rounded-full border-2 border-white text-xs font-black text-ink-950"
                style={{ backgroundColor: COLOR_HEX[player.color] }}
              >
                {player.isBot ? "🤖" : player.name.trim().charAt(0).toUpperCase() || "?"}
                {player.connection && player.connection !== "unknown" && !player.hasLeft && (
                  <span
                    className={cn(
                      "absolute -right-1 -bottom-1 size-3 rounded-full ring-2 ring-ink-950",
                      player.connection === "online" ? "bg-emerald-400" : "bg-zinc-500",
                    )}
                  >
                    <span className="sr-only">{player.connection === "online" ? "Online" : "Offline"}</span>
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-semibold", player.hasLeft && "line-through")}>
                  {player.name}
                  {player.isYou && player.name !== "You" && (
                    <span className="ml-1.5 text-xs font-medium text-sky-300">(you)</span>
                  )}
                </span>
                <span className="block text-xs text-zinc-400">
                  {player.hasLeft
                    ? "Left the game"
                    : state.winnerId === player.id
                      ? "Winner 🏆"
                      : rollingId === player.id
                        ? "Rolling…"
                        : isTurn
                          ? state.phase === "move"
                            ? "Choosing a token…"
                            : player.isYou
                              ? "Your turn"
                              : "Their turn"
                          : " "}
                </span>
                {!player.hasLeft && (
                  <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${progress * 100}%`, backgroundColor: COLOR_HEX[player.color] }}
                    />
                  </span>
                )}
              </span>
              {!player.hasLeft && (
                <span className="text-right text-xs text-zinc-400 tabular-nums">
                  <b className="text-sm text-zinc-100">{home}</b>/4 home
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Board, dice and players for one game of Ludo, wherever the state comes from. */
export function LudoGameView({
  state,
  players,
  viewerColor,
  animation,
  rollingId,
  canRoll,
  canPick,
  onPick,
  diceTitle,
  diceDetail,
  onHoldStart,
  onRelease,
  finished,
  finishedPanel,
  footer,
  error,
}: {
  state: LudoState;
  players: LudoPlayer[];
  /** The board is turned so this color's yard is bottom left. */
  viewerColor: LudoColor;
  animation: MoveAnimation;
  /** Player whose dice is visibly spinning (holding, or a roll in flight). */
  rollingId: string | null;
  canRoll: boolean;
  /** The viewer may pick one of `state.movable` now. */
  canPick: boolean;
  onPick: (token: number) => void;
  diceTitle: string;
  diceDetail?: string;
  onHoldStart?: () => void;
  onRelease: () => void;
  /** The game is over (won, or abandoned). */
  finished: boolean;
  /** Shown instead of the dice once the game is over and the last move has played out. */
  finishedPanel?: ReactNode;
  footer?: ReactNode;
  error?: string | null;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const byId = new Map(players.map((p) => [p.id, p]));
  const { shownRoll } = animation;
  const showFinished = finished && !animation.animating;
  const me = players.find((p) => p.isYou);
  const turnColor = state.winnerId ? null : (byId.get(state.turn)?.color ?? null);

  const tokens: BoardToken[] = players.flatMap((player) =>
    player.hasLeft || !animation.tokens[player.id]
      ? []
      : animation.tokens[player.id].map((step, token) => ({
          playerId: player.id,
          token,
          color: player.color,
          step,
          movable: canPick && player.isYou && state.turn === player.id && state.movable.includes(token),
          moving: animation.moving?.playerId === player.id && animation.moving.token === token,
          returning: animation.returning.some((r) => r.playerId === player.id && r.token === token),
        })),
  );

  // Where the token being pointed at would land.
  const previewStep =
    canPick && me && preview !== null && state.movable.includes(preview)
      ? targetStep(state.tokens[me.id][preview], state.history[0].value)
      : null;
  const target = previewStep !== null && me ? cellOf(me.color, previewStep) : null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="mx-auto w-full max-w-[34rem]">
        <LudoBoard
          tokens={tokens}
          viewerColor={viewerColor}
          activeColor={turnColor}
          labels={players
            .filter((p) => !p.hasLeft)
            .map((p) => ({ color: p.color, name: p.isYou ? "You" : p.name, active: p.color === turnColor }))}
          target={target}
          onPick={(token) => {
            setPreview(null);
            onPick(token);
          }}
          onPreview={setPreview}
        />
      </div>

      <div className="flex flex-col gap-4">
        {showFinished ? (
          finishedPanel
        ) : (
          // On phones the dice stays pinned to the bottom of the screen, always in reach.
          <div className="sticky bottom-3 z-30 rounded-3xl bg-ink-950/85 backdrop-blur-md lg:static lg:bg-transparent lg:backdrop-blur-none">
            <HoldDicePad
              value={shownRoll?.value ?? null}
              landKey={shownRoll?.seq ?? null}
              canHold={canRoll}
              spinning={rollingId !== null}
              title={diceTitle}
              detail={diceDetail}
              onHoldStart={onHoldStart}
              onRelease={onRelease}
            />
          </div>
        )}

        <p
          aria-live="polite"
          data-testid="last-roll"
          className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300"
        >
          {shownRoll
            ? describeRoll(shownRoll, (id) => byId.get(id)?.name ?? "Someone", me?.id ?? null)
            : "Hold the dice to roll. You need a 6 to bring a token out."}
        </p>

        {error && (
          <p role="alert" className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        )}

        <PlayersPanel players={players} state={state} tokens={animation.tokens} rollingId={rollingId} />
        {footer}
      </div>
    </div>
  );
}
