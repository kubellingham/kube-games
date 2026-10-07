"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Connection } from "../../components/player-indicator";
import { describeRoll } from "../logic/describe-roll";
import type { SnlState } from "../logic/types";
import { SnlBoard } from "./board";
import { HoldDicePad } from "./hold-dice";
import type { RollAnimation } from "./use-roll-animation";

export interface SnlPlayer {
  id: string;
  name: string;
  color: string;
  isYou: boolean;
  isBot?: boolean;
  connection?: Connection;
  hasLeft?: boolean;
}

function PlayersPanel({
  players,
  state,
  positions,
  rollingId,
}: {
  players: SnlPlayer[];
  state: SnlState;
  positions: Record<string, number>;
  rollingId: string | null;
}) {
  return (
    <section aria-label="Players" className="rounded-3xl border border-white/10 bg-white/[0.03] p-3">
      <ul className="flex flex-col gap-1">
        {players.map((player) => {
          const isTurn = !state.winnerId && state.turn === player.id && !player.hasLeft;
          const position = positions[player.id] ?? 0;
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
                style={{ backgroundColor: player.color }}
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
                    <span className="ml-1.5 text-xs font-medium text-emerald-300">(you)</span>
                  )}
                </span>
                <span className="block text-xs text-zinc-400">
                  {player.hasLeft
                    ? "Left the game"
                    : rollingId === player.id
                      ? "Rolling…"
                      : isTurn
                        ? player.isYou
                          ? "Your turn"
                          : "Their turn"
                        : state.winnerId === player.id
                          ? "Winner 🏆"
                          : " "}
                </span>
              </span>
              <span className="text-right text-xs text-zinc-400 tabular-nums">
                {player.hasLeft ? "" : position === 0 ? "Start" : <>Square <b className="text-sm text-zinc-100">{position}</b></>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Board, dice and players for one game of Snakes & Ladders, wherever the state comes from. */
export function SnlGameView({
  state,
  players,
  animation,
  rollingId,
  canRoll,
  diceTitle,
  diceDetail,
  onHoldStart,
  onRelease,
  finished,
  finishedPanel,
  footer,
  error,
}: {
  state: SnlState;
  players: SnlPlayer[];
  animation: RollAnimation;
  /** Player whose dice is visibly spinning (holding, or a roll in flight). */
  rollingId: string | null;
  canRoll: boolean;
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
  const byId = new Map(players.map((p) => [p.id, p]));
  const { shownRoll, positions } = animation;
  const roller = shownRoll ? byId.get(shownRoll.playerId) : undefined;
  const showFinished = finished && !animation.animating;

  const tokens = players
    .filter((p) => !p.hasLeft && p.id in positions)
    .map((p) => ({
      id: p.id,
      label: p.isBot ? "🤖" : p.name.trim().charAt(0).toUpperCase() || "?",
      color: p.color,
      position: positions[p.id],
      active: !state.winnerId && state.turn === p.id,
      jumping: animation.jumpingPlayerId === p.id,
    }));

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="mx-auto w-full max-w-[34rem]">
        <SnlBoard tokens={tokens} highlight={animation.animating ? null : (shownRoll?.to ?? null)} />
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
          {shownRoll && roller
            ? describeRoll(shownRoll, roller.name, roller.isYou)
            : "Hold the dice to roll. First to land exactly on 100 wins."}
        </p>

        {error && (
          <p role="alert" className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        )}

        <PlayersPanel players={players} state={state} positions={positions} rollingId={rollingId} />
        {footer}
      </div>
    </div>
  );
}

export function WinnerPanel({ title, detail, children }: { title: string; detail?: string; children?: ReactNode }) {
  return (
    <section
      role="status"
      className="flex animate-pop-in flex-col items-center gap-4 rounded-3xl border border-amber-300/30 bg-amber-300/10 px-5 py-7 text-center"
    >
      <span aria-hidden className="text-5xl">
        🏆
      </span>
      <div>
        <h2 className="font-display text-2xl font-extrabold">{title}</h2>
        {detail && <p className="mt-1 text-sm text-zinc-300">{detail}</p>}
      </div>
      {children && <div className="flex flex-wrap justify-center gap-3">{children}</div>}
    </section>
  );
}
