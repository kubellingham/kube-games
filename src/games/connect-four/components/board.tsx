"use client";

import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { landingRow } from "../logic/board";
import { COLUMNS, ROWS, type Board, type CellPos, type Disc } from "../logic/types";

// Board geometry in SVG units: 100 per cell, plus a frame around the grid.
const CELL = 100;
const PAD = 18;
const HOLE_RADIUS = 40;
const CORNER = 30;
const FRAME_W = COLUMNS * CELL + 2 * PAD;
const FRAME_H = ROWS * CELL + 2 * PAD;
const CENTER = Math.floor(COLUMNS / 2);

const pctX = (units: number) => `${(units / FRAME_W) * 100}%`;
const pctY = (units: number) => `${(units / FRAME_H) * 100}%`;
const columnBox = (column: number): CSSProperties => ({ left: pctX(PAD + column * CELL), width: pctX(CELL) });

const DISC_STYLES: Record<Disc, CSSProperties> = {
  red: {
    background: "radial-gradient(circle at 34% 30%, #ffe4e6 0%, #fb7185 17%, #f43f5e 42%, #e11d48 72%, #9f1239 100%)",
    boxShadow: "inset 0 -3px 6px rgb(76 5 25 / 0.45), 0 2px 4px rgb(0 0 0 / 0.35)",
  },
  yellow: {
    background: "radial-gradient(circle at 34% 30%, #fefce8 0%, #fde047 18%, #facc15 45%, #eab308 74%, #a16207 100%)",
    boxShadow: "inset 0 -3px 6px rgb(113 63 18 / 0.45), 0 2px 4px rgb(0 0 0 / 0.35)",
  },
};

const DISC_GROOVES: Record<Disc, CSSProperties> = {
  red: { boxShadow: "inset 0 2px 3px rgb(136 19 55 / 0.6), 0 1px 0 rgb(255 255 255 / 0.25)" },
  yellow: { boxShadow: "inset 0 2px 3px rgb(133 77 14 / 0.55), 0 1px 0 rgb(255 255 255 / 0.4)" },
};

/** A glossy playing disc with a moulded inner ring. Fills its box; size it with `className`. */
export function DiscFace({ disc, className }: { disc: Disc; className?: string }) {
  return (
    <span aria-hidden className={cn("relative block aspect-square rounded-full", className)} style={DISC_STYLES[disc]}>
      <span className="absolute inset-[19%] rounded-full" style={DISC_GROOVES[disc]} />
    </span>
  );
}

/** The board's face: a rounded slab with a hole per cell, drawn over the discs so they show through. */
function BoardFace({ id }: { id: string }) {
  const W = FRAME_W;
  const H = FRAME_H;
  const R = CORNER;
  const holes: string[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const cx = PAD + column * CELL + CELL / 2;
      const cy = PAD + row * CELL + CELL / 2;
      holes.push(`M${cx - HOLE_RADIUS} ${cy}a${HOLE_RADIUS} ${HOLE_RADIUS} 0 1 0 ${2 * HOLE_RADIUS} 0a${HOLE_RADIUS} ${HOLE_RADIUS} 0 1 0 ${-2 * HOLE_RADIUS} 0Z`);
    }
  }
  const slab = `M${R} 0H${W - R}A${R} ${R} 0 0 1 ${W} ${R}V${H - R}A${R} ${R} 0 0 1 ${W - R} ${H}H${R}A${R} ${R} 0 0 1 0 ${H - R}V${R}A${R} ${R} 0 0 1 ${R} 0Z`;

  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
      <defs>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#6d73f5" />
          <stop offset="45%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#3730a3" />
        </linearGradient>
        {/* Holes are recessed: shadowed along the top edge, catching light along the bottom. */}
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(15 10 60)" stopOpacity="0.7" />
          <stop offset="55%" stopColor="rgb(15 10 60)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="white" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path d={`${slab}${holes.join("")}`} fill={`url(#${id}-face)`} fillRule="evenodd" />
      <g fill="none" stroke={`url(#${id}-rim)`} strokeWidth={4}>
        {Array.from({ length: ROWS * COLUMNS }, (_, i) => (
          <circle
            key={i}
            cx={PAD + (i % COLUMNS) * CELL + CELL / 2}
            cy={PAD + Math.floor(i / COLUMNS) * CELL + CELL / 2}
            r={HOLE_RADIUS + 2}
          />
        ))}
      </g>
      <path d={slab} fill="none" stroke="white" strokeOpacity={0.2} strokeWidth={3} />
    </svg>
  );
}

/** The open column nearest `around` (left first on a tie), or null when the board is full. */
function nearestOpenColumn(board: Board, around: number): number | null {
  for (let distance = 0; distance < COLUMNS; distance++) {
    for (const column of [around - distance, around + distance]) {
      if (landingRow(board, column) !== null) return column;
    }
  }
  return null;
}

/** The next open column from `from` in direction `step`, or null at the edge. */
function stepColumn(board: Board, from: number | null, step: -1 | 1): number | null {
  if (from === null) return nearestOpenColumn(board, CENTER);
  for (let column = from + step; column >= 0 && column < COLUMNS; column += step) {
    if (landingRow(board, column) !== null) return column;
  }
  return null;
}

function describeColumn(board: Board, column: number): string {
  const discs: Disc[] = [];
  for (let row = ROWS - 1; row >= 0 && board[row][column]; row--) discs.push(board[row][column]!);
  if (discs.length === 0) return "Empty.";
  return `${discs.length === ROWS ? "Full" : `${discs.length} of ${ROWS} filled`}, bottom to top: ${discs.join(", ")}.`;
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable]") !== null;

/**
 * A Connect Four board, wherever the game state comes from. One button per
 * column drops a disc; a preview hangs over the column you're aiming at, and
 * each new disc falls into place. On a keyboard: ←/→ to aim, Enter or Space to
 * drop, or 1–7 to drop straight into a column.
 */
export function C4Board({
  board,
  playerDisc,
  canDrop,
  onDrop,
  lastMove,
  moveCount,
  winningCells,
  ghost = null,
  onAimChange,
  status,
  statusDisc = null,
  statusDetail,
}: {
  board: Board;
  /** The colour this player drops, shown in the preview. */
  playerDisc: Disc;
  /** Whether this player may drop a disc right now. */
  canDrop: boolean;
  onDrop: (column: number) => void;
  /** The latest drop; it falls into place whenever it changes. */
  lastMove: CellPos | null;
  moveCount: number;
  winningCells: readonly CellPos[];
  /** Where the other player is aiming, shown faintly while it's their move. */
  ghost?: { column: number; disc: Disc } | null;
  /** Called when this player's aim moves to another column, or off the board (null). */
  onAimChange?: (column: number | null) => void;
  /** Whose turn it is, or the result. Announced to screen readers. */
  status: string;
  /** Colour shown next to the status (whose turn it is, or the winner). */
  statusDisc?: Disc | null;
  statusDetail?: ReactNode;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const aimRowRef = useRef<HTMLDivElement>(null);
  const [aim, setAim] = useState<number | null>(null);

  const isOpen = (column: number) => landingRow(board, column) !== null;
  const winning = new Set(winningCells.map((cell) => `${cell.row}-${cell.column}`));
  const someoneWon = winning.size > 0;

  const updateAim = (column: number | null) => {
    if (column === aim) return;
    setAim(column);
    onAimChange?.(column);
  };

  const drop = (column: number) => {
    if (!canDrop || !isOpen(column)) return;
    updateAim(column);
    onDrop(column);
  };

  // Keyboard play works from anywhere on the page, not just when a column has focus.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!canDrop || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const columnFocused = target?.dataset.c4Column !== undefined && rootRef.current?.contains(target);

    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= COLUMNS) {
      event.preventDefault();
      if (!event.repeat) drop(digit - 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const next = stepColumn(board, aim, event.key === "ArrowLeft" ? -1 : 1);
      if (next === null) return;
      event.preventDefault();
      updateAim(next);
      if (columnFocused) rootRef.current?.querySelector<HTMLElement>(`[data-c4-column="${next}"]`)?.focus();
    } else if ((event.key === "Enter" || event.key === " ") && target === document.body) {
      // Focused buttons (a column included) handle Enter and Space themselves.
      event.preventDefault();
      if (event.repeat) return;
      if (aim !== null && isOpen(aim)) drop(aim);
      else updateAim(nearestOpenColumn(board, CENTER));
    }
  });

  useEffect(() => {
    if (!canDrop) return;
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [canDrop]);

  // Each new disc falls from the preview row into its cell, with a small bounce.
  const dropKey = lastMove ? `${moveCount}:${lastMove.row}:${lastMove.column}` : null;
  const lastRow = lastMove?.row ?? null;
  const lastColumn = lastMove?.column ?? null;
  // Discs already on the board when it first appears (e.g. after a refresh) don't fall again.
  const animatedKey = useRef(dropKey);
  useLayoutEffect(() => {
    if (animatedKey.current === dropKey) return;
    animatedKey.current = dropKey;
    if (lastRow === null || lastColumn === null) return;
    const cell = rootRef.current?.querySelector<HTMLElement>(`[data-testid="c4-cell-${lastRow}-${lastColumn}"]`);
    const disc = cell?.querySelector<HTMLElement>("[data-c4-disc]");
    const aimRow = aimRowRef.current;
    if (!cell || !disc || !aimRow || typeof disc.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cellBox = cell.getBoundingClientRect();
    const fall = aimRow.getBoundingClientRect().top - cellBox.top;
    const rows = Math.max(1, -fall / cellBox.height);
    const animation = disc.animate(
      [
        // Speeds up as it falls, lands, hops back up a little and settles.
        { transform: `translateY(${fall}px)`, easing: "cubic-bezier(0.55, 0, 0.9, 0.55)" },
        { transform: "translateY(0)", offset: 0.72, easing: "cubic-bezier(0.25, 0.6, 0.45, 1)" },
        { transform: `translateY(${-cellBox.height * 0.13}px)`, offset: 0.86, easing: "cubic-bezier(0.55, 0, 0.85, 0.45)" },
        { transform: "translateY(0)" },
      ],
      { duration: (200 + 120 * Math.sqrt(rows)) / 0.72 },
    );
    return () => animation.cancel();
  }, [dropKey, lastRow, lastColumn]);

  const tabColumn = aim !== null && isOpen(aim) ? aim : nearestOpenColumn(board, CENTER);
  const shownAim =
    canDrop && aim !== null && isOpen(aim)
      ? { column: aim, disc: playerDisc, faint: false }
      : !canDrop && ghost && isOpen(ghost.column)
        ? { ...ghost, faint: true }
        : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-9 items-center justify-center gap-2.5 text-center">
        {statusDisc && <DiscFace disc={statusDisc} className="size-6 shrink-0" />}
        <p data-testid="c4-status" aria-live="polite" className="font-display text-xl font-extrabold sm:text-2xl">
          {status}
        </p>
      </div>
      <p className="min-h-5 text-center text-sm text-zinc-400">{statusDetail}</p>

      <div ref={rootRef} data-testid="c4-board" className="relative mx-auto w-full max-w-[min(30rem,62dvh)] select-none">
        {/* The aim row: the next disc hangs here before it drops. */}
        <div ref={aimRowRef} aria-hidden className="relative" style={{ aspectRatio: `${FRAME_W} / ${CELL}` }}>
          {shownAim && (
            <div
              data-testid="c4-aim"
              data-column={shownAim.column}
              data-faint={shownAim.faint || undefined}
              className="absolute top-0 h-full transition-[left] duration-150 ease-out motion-reduce:transition-none"
              style={columnBox(shownAim.column)}
            >
              <DiscFace
                disc={shownAim.disc}
                className={cn("absolute inset-[8%] size-auto", shownAim.faint ? "opacity-35" : "animate-float")}
              />
            </div>
          )}
        </div>

        <div className="relative" style={{ aspectRatio: `${FRAME_W} / ${FRAME_H}` }}>
          {/* What you see through an empty hole. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-b from-indigo-950 to-ink-950 shadow-2xl shadow-indigo-950/60"
            style={{ borderRadius: `${pctX(CORNER)} / ${pctY(CORNER)}` }}
          />

          <div
            aria-hidden
            className="absolute grid grid-cols-7 grid-rows-6"
            style={{ left: pctX(PAD), right: pctX(PAD), top: pctY(PAD), bottom: pctY(PAD) }}
          >
            {board.map((cells, row) =>
              cells.map((cell, column) => {
                const isWinning = winning.has(`${row}-${column}`);
                const isLast = lastMove?.row === row && lastMove.column === column;
                return (
                  <div
                    key={`${row}-${column}`}
                    data-testid={`c4-cell-${row}-${column}`}
                    data-disc={cell ?? undefined}
                    data-winning={isWinning ? "" : undefined}
                    className="relative"
                  >
                    {cell && (
                      <span
                        data-c4-disc
                        className={cn(
                          "absolute inset-[7%] transition-opacity delay-300 duration-500",
                          someoneWon && !isWinning && "opacity-30",
                        )}
                      >
                        <DiscFace disc={cell} className="size-full" />
                        {isLast && !someoneWon && <span className="absolute inset-[43%] rounded-full bg-white/60" />}
                      </span>
                    )}
                  </div>
                );
              }),
            )}
          </div>

          <BoardFace id={id} />

          {someoneWon && (
            <div
              aria-hidden
              className="pointer-events-none absolute grid grid-cols-7 grid-rows-6"
              style={{ left: pctX(PAD), right: pctX(PAD), top: pctY(PAD), bottom: pctY(PAD) }}
            >
              {winningCells.map(({ row, column }) => (
                <span
                  key={`${row}-${column}`}
                  className="relative animate-pop-in [animation-delay:450ms]"
                  style={{ gridRow: row + 1, gridColumn: column + 1 }}
                >
                  <span className="absolute inset-[6%] animate-pulse-soft rounded-full border-[3px] border-white shadow-[0_0_14px_2px_rgb(255_255_255/0.55)]" />
                </span>
              ))}
            </div>
          )}
        </div>

        {/* One button per column, the full height of the board (aim row included). */}
        <div
          className="absolute inset-0"
          onPointerMove={(event) => {
            if (event.pointerType === "touch") return;
            const box = event.currentTarget.getBoundingClientRect();
            const units = ((event.clientX - box.left) / box.width) * FRAME_W;
            updateAim(Math.min(COLUMNS - 1, Math.max(0, Math.floor((units - PAD) / CELL))));
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch") updateAim(null);
          }}
        >
          {board[0].map((_, column) => (
            <button
              key={column}
              type="button"
              data-c4-column={column}
              aria-label={`Drop in column ${column + 1}`}
              aria-describedby={`${id}-column-${column}`}
              aria-keyshortcuts={String(column + 1)}
              disabled={!canDrop || !isOpen(column)}
              tabIndex={column === tabColumn ? 0 : -1}
              onClick={() => drop(column)}
              onFocus={() => updateAim(column)}
              onBlur={(event) => {
                if (!rootRef.current?.contains(event.relatedTarget as Node | null)) updateAim(null);
              }}
              className={cn(
                "absolute inset-y-0 cursor-pointer touch-manipulation rounded-2xl transition-colors duration-150 outline-none",
                "hover:bg-white/[0.05] focus-visible:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-white/70",
                "disabled:pointer-events-none disabled:cursor-default",
              )}
              style={columnBox(column)}
            >
              <span id={`${id}-column-${column}`} className="sr-only">
                {describeColumn(board, column)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
