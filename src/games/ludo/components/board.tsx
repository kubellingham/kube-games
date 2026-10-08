import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import {
  BOARD_SIZE,
  cellOf,
  COLOR_HEX,
  COLOR_NAMES,
  COLOR_SPACING,
  HOME_COLUMNS,
  isSafeSquare,
  TRACK,
  YARD_ORIGINS,
  type Cell,
} from "../logic/board";
import { HOME, YARD, type LudoColor, type TokenStep } from "../logic/types";

const COLORS = [0, 1, 2, 3] as const;
const SURFACE = "#15141f";

export interface BoardToken {
  playerId: string;
  token: number;
  color: LudoColor;
  step: TokenStep;
  /** The player can move this token now. */
  movable?: boolean;
  /** Hopping square by square right now. */
  moving?: boolean;
  /** Captured, sliding back to the yard. */
  returning?: boolean;
}

export interface YardLabel {
  color: LudoColor;
  name: string;
  active: boolean;
}

interface Point {
  x: number;
  y: number;
}

// Token spots in a yard, relative to its top-left corner (in cells).
const YARD_SLOTS: Point[] = [
  { x: 2, y: 2 },
  { x: 4, y: 2 },
  { x: 2, y: 4 },
  { x: 4, y: 4 },
];
// Where finished tokens gather, in each color's triangle of the center.
const HOME_SPOTS: Record<LudoColor, Point> = {
  0: { x: 6.6, y: 7.5 },
  1: { x: 7.5, y: 6.6 },
  2: { x: 8.4, y: 7.5 },
  3: { x: 7.5, y: 8.4 },
};
const SPREAD = [
  { x: -0.22, y: -0.22 },
  { x: 0.22, y: -0.22 },
  { x: -0.22, y: 0.22 },
  { x: 0.22, y: 0.22 },
];

/** Turns the board a quarter turn anticlockwise `turns` times, so each player sees their own yard bottom left. */
function rotate({ x, y }: Point, turns: number): Point {
  let point = { x, y };
  for (let i = 0; i < turns; i++) point = { x: point.y, y: BOARD_SIZE - point.x };
  return point;
}

export function rotationFor(color: LudoColor): number {
  // Blue's yard is already bottom left; each color before it is a quarter turn further round.
  return (color + 1) % 4;
}

function cellCenter([row, col]: Cell): Point {
  return { x: col + 0.5, y: row + 0.5 };
}

/** Each token's center (in unrotated cells) and drawing scale, spreading out tokens that share a square. */
function layout(tokens: BoardToken[]) {
  const groups = new Map<string, BoardToken[]>();
  const keyOf = (t: BoardToken) => {
    if (t.step === YARD) return null;
    if (t.step === HOME) return `home-${t.color}`;
    const [row, col] = cellOf(t.color, t.step)!;
    return `${row},${col}`;
  };
  for (const token of tokens) {
    const key = keyOf(token);
    if (key) groups.set(key, [...(groups.get(key) ?? []), token]);
  }
  return tokens.map((token) => {
    if (token.step === YARD) {
      const [row, col] = YARD_ORIGINS[token.color];
      const slot = YARD_SLOTS[token.token];
      return { token, point: { x: col + slot.x, y: row + slot.y }, scale: 1 };
    }
    const group = groups.get(keyOf(token)!)!;
    const base = token.step === HOME ? HOME_SPOTS[token.color] : cellCenter(cellOf(token.color, token.step)!);
    if (group.length === 1 && token.step !== HOME) return { token, point: base, scale: 1 };
    const offset = SPREAD[group.indexOf(token) % SPREAD.length];
    const spread = token.step === HOME ? 0.9 : 1;
    return {
      token,
      point: { x: base.x + offset.x * spread, y: base.y + offset.y * spread },
      scale: token.step === HOME ? 0.55 : 0.72,
    };
  });
}

function Star({ cell }: { cell: Cell }) {
  const { x, y } = cellCenter(cell);
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 0.36 : 0.15;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
  }).join(" ");
  return <polygon points={points} fill="rgb(255 255 255 / 0.4)" />;
}

function BoardArt({ activeColor, target }: { activeColor: LudoColor | null; target: Cell | null }) {
  const c = BOARD_SIZE / 2;
  return (
    <>
      <rect width={BOARD_SIZE} height={BOARD_SIZE} rx={0.5} fill={SURFACE} />
      {TRACK.map(([row, col], i) => {
        const start = i % COLOR_SPACING === 0;
        return (
          <rect
            key={`t${i}`}
            x={col}
            y={row}
            width={1}
            height={1}
            fill={start ? COLOR_HEX[(i / COLOR_SPACING) as LudoColor] : "rgb(255 255 255 / 0.07)"}
            fillOpacity={start ? 0.85 : 1}
            stroke="rgb(255 255 255 / 0.12)"
            strokeWidth={0.04}
          />
        );
      })}
      {COLORS.map((color) =>
        HOME_COLUMNS[color].map(([row, col], i) => (
          <rect
            key={`h${color}-${i}`}
            x={col}
            y={row}
            width={1}
            height={1}
            fill={COLOR_HEX[color]}
            fillOpacity={0.8}
            stroke="rgb(0 0 0 / 0.25)"
            strokeWidth={0.04}
          />
        )),
      )}
      {TRACK.map((cell, i) => (isSafeSquare(i) && i % COLOR_SPACING !== 0 ? <Star key={`s${i}`} cell={cell} /> : null))}
      {COLORS.map((color) => {
        const [row, col] = YARD_ORIGINS[color];
        const active = activeColor === color;
        return (
          <g key={`y${color}`}>
            <rect
              x={col + 0.08}
              y={row + 0.08}
              width={5.84}
              height={5.84}
              rx={0.45}
              fill={COLOR_HEX[color]}
              fillOpacity={0.88}
              stroke={active ? "white" : "none"}
              strokeWidth={0.14}
            />
            <rect x={col + 1} y={row + 1} width={4} height={4} rx={0.5} fill={SURFACE} />
            {YARD_SLOTS.map((slot, i) => (
              <circle
                key={i}
                cx={col + slot.x}
                cy={row + slot.y}
                r={0.62}
                fill={COLOR_HEX[color]}
                fillOpacity={0.2}
                stroke={COLOR_HEX[color]}
                strokeOpacity={0.6}
                strokeWidth={0.08}
              />
            ))}
          </g>
        );
      })}
      {/* The center: each color's home triangle points at its own column. */}
      <polygon points={`6,6 6,9 ${c},${c}`} fill={COLOR_HEX[0]} />
      <polygon points={`6,6 9,6 ${c},${c}`} fill={COLOR_HEX[1]} />
      <polygon points={`9,6 9,9 ${c},${c}`} fill={COLOR_HEX[2]} />
      <polygon points={`6,9 9,9 ${c},${c}`} fill={COLOR_HEX[3]} />
      <rect x={6} y={6} width={3} height={3} fill="none" stroke="rgb(0 0 0 / 0.3)" strokeWidth={0.05} />
      {target && (
        <rect
          x={target[1] + 0.06}
          y={target[0] + 0.06}
          width={0.88}
          height={0.88}
          rx={0.15}
          fill="rgb(255 255 255 / 0.25)"
          stroke="white"
          strokeWidth={0.08}
          className="animate-pulse"
        />
      )}
    </>
  );
}

/**
 * The Ludo board, turned so the viewer's yard is at the bottom left. Tokens are
 * buttons, so a movable one can be tapped, clicked or picked with the keyboard.
 */
export function LudoBoard({
  tokens,
  viewerColor,
  activeColor,
  labels,
  target,
  onPick,
  onPreview,
}: {
  tokens: BoardToken[];
  viewerColor: LudoColor;
  /** Whose turn it is (their yard is outlined). */
  activeColor: LudoColor | null;
  labels: YardLabel[];
  /** Square to highlight, e.g. where the token being considered would land. */
  target: Cell | null;
  onPick?: (token: number) => void;
  onPreview?: (token: number | null) => void;
}) {
  const turns = rotationFor(viewerColor);
  const at = (point: Point): CSSProperties => {
    const p = rotate(point, turns);
    return { left: `${(p.x / BOARD_SIZE) * 100}%`, top: `${(p.y / BOARD_SIZE) * 100}%` };
  };

  return (
    <div className="relative aspect-square w-full select-none" data-testid="ludo-board">
      <svg
        viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
        className="absolute inset-0 size-full overflow-hidden rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10"
        aria-hidden
      >
        <g transform={`rotate(${-90 * turns} ${BOARD_SIZE / 2} ${BOARD_SIZE / 2})`}>
          <BoardArt activeColor={activeColor} target={target} />
        </g>
      </svg>

      {labels.map(({ color, name, active }) => {
        // The top edge of the yard as drawn after turning the board.
        const [row, col] = YARD_ORIGINS[color];
        const corners = [
          { x: col, y: row },
          { x: col + 6, y: row + 6 },
        ].map((p) => rotate(p, turns));
        const left = Math.min(corners[0].x, corners[1].x);
        const top = Math.min(corners[0].y, corners[1].y);
        return (
          <span
            key={color}
            className={cn(
              "absolute max-w-[24%] -translate-x-1/2 -translate-y-1/2 truncate rounded-full px-1.5 text-[clamp(9px,2.2vw,12px)] leading-tight font-bold text-ink-950",
              active ? "bg-white" : "bg-white/70",
            )}
            style={{ left: `${((left + 3) / BOARD_SIZE) * 100}%`, top: `${((top + 0.52) / BOARD_SIZE) * 100}%` }}
          >
            {name}
          </span>
        );
      })}

      {layout(tokens).map(({ token, point, scale }) => (
        <button
          key={`${token.playerId}-${token.token}`}
          type="button"
          disabled={!token.movable}
          aria-hidden={!token.movable || undefined}
          aria-label={`Move ${COLOR_NAMES[token.color]} token ${token.token + 1}`}
          data-testid={`token-${token.playerId}-${token.token}`}
          data-step={token.step}
          data-movable={token.movable || undefined}
          onClick={() => onPick?.(token.token)}
          onPointerEnter={() => token.movable && onPreview?.(token.token)}
          onPointerLeave={() => onPreview?.(null)}
          onFocus={() => token.movable && onPreview?.(token.token)}
          onBlur={() => onPreview?.(null)}
          className={cn(
            "absolute grid aspect-square -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.25),0_3px_8px_rgb(0_0_0/0.55)] disabled:cursor-default",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
            token.movable ? "z-20 cursor-pointer" : "z-10",
            token.moving && "z-30",
          )}
          style={{
            ...at(point),
            width: `${5.4 * scale}%`,
            backgroundColor: COLOR_HEX[token.color],
            transition: token.returning
              ? "left 500ms ease-in-out, top 500ms ease-in-out, width 200ms"
              : token.moving
                ? "left 140ms ease-out, top 140ms ease-out, width 200ms"
                : "left 250ms ease-out, top 250ms ease-out, width 200ms",
          }}
        >
          {token.movable && (
            <>
              <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-white/60" />
              {/* A bigger target for fingers than the token itself. */}
              <span aria-hidden className="absolute -inset-[45%] rounded-full" />
            </>
          )}
          <span aria-hidden className="size-[38%] rounded-full bg-white/35" />
        </button>
      ))}
    </div>
  );
}
