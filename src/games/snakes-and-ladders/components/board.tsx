import { cn } from "@/lib/cn";
import { BOARD_COLUMNS, FINAL_SQUARE, LADDERS, SNAKES, squareToCell } from "../logic/board";

export const TOKEN_COLORS = ["#a78bfa", "#fbbf24", "#38bdf8", "#fb7185"] as const;

const SNAKE_COLORS = ["#f43f5e", "#84cc16", "#a855f7", "#f97316", "#06b6d4", "#ec4899", "#eab308", "#22c55e", "#ef4444", "#6366f1"];

// The board is 100 units square; the start lane adds 10 units below it.
const BOARD_HEIGHT = 110;

function center(square: number) {
  const { row, col } = squareToCell(square);
  return { x: col * 10 + 5, y: row * 10 + 5 };
}

function squareAt(row: number, col: number): number {
  const rowFromBottom = BOARD_COLUMNS - 1 - row;
  const offset = rowFromBottom % 2 === 0 ? col : BOARD_COLUMNS - 1 - col;
  return rowFromBottom * BOARD_COLUMNS + offset + 1;
}

function Ladder({ from, to }: { from: number; to: number }) {
  const a = center(from);
  const b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const px = (-dy / length) * 1.6;
  const py = (dx / length) * 1.6;
  const rungs = Math.max(2, Math.floor(length / 3.2));
  return (
    <g strokeLinecap="round">
      {[1, -1].map((side) => (
        <line
          key={side}
          x1={a.x + px * side}
          y1={a.y + py * side}
          x2={b.x + px * side}
          y2={b.y + py * side}
          stroke="#fcd34d"
          strokeWidth={0.8}
        />
      ))}
      {Array.from({ length: rungs - 1 }, (_, i) => {
        const t = (i + 1) / rungs;
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        return <line key={i} x1={x + px} y1={y + py} x2={x - px} y2={y - py} stroke="#fde68a" strokeWidth={0.6} />;
      })}
    </g>
  );
}

function Snake({ head, tail, color }: { head: number; tail: number; color: string }) {
  const a = center(head);
  const b = center(tail);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const bend = Math.min(9, length * 0.28);
  const nx = (-dy / length) * bend;
  const ny = (dx / length) * bend;
  const path = `M ${a.x} ${a.y} C ${a.x + dx * 0.3 + nx} ${a.y + dy * 0.3 + ny}, ${a.x + dx * 0.7 - nx} ${
    a.y + dy * 0.7 - ny
  }, ${b.x} ${b.y}`;
  // Eyes sit either side of the head, across the direction the body leaves in.
  const ex = (-dy / length) * 0.9;
  const ey = (dx / length) * 0.9;
  return (
    <g>
      <path d={path} stroke="rgb(0 0 0 / 0.35)" strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <path d={path} stroke={color} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <path d={path} stroke="rgb(255 255 255 / 0.35)" strokeWidth={0.7} strokeDasharray="1.2 1.8" fill="none" />
      <circle cx={a.x} cy={a.y} r={2.2} fill={color} stroke="rgb(0 0 0 / 0.35)" strokeWidth={0.4} />
      {[1, -1].map((side) => (
        <g key={side}>
          <circle cx={a.x + ex * side} cy={a.y + ey * side} r={0.6} fill="white" />
          <circle cx={a.x + ex * side} cy={a.y + ey * side} r={0.28} fill="black" />
        </g>
      ))}
    </g>
  );
}

export interface BoardToken {
  id: string;
  label: string;
  color: string;
  position: number;
  /** Highlights the token whose turn it is. */
  active?: boolean;
  /** Sliding along a snake or ladder: animate more slowly. */
  jumping?: boolean;
}

// Spread tokens that share a square so they stay visible.
const SHARED_OFFSETS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-1.9, 0],
    [1.9, 0],
  ],
  3: [
    [-1.9, -1.6],
    [1.9, -1.6],
    [0, 1.8],
  ],
  4: [
    [-1.9, -1.9],
    [1.9, -1.9],
    [-1.9, 1.9],
    [1.9, 1.9],
  ],
};

function tokenPoints(tokens: BoardToken[]) {
  const onSquare = new Map<number, BoardToken[]>();
  for (const token of tokens) {
    if (token.position > 0) onSquare.set(token.position, [...(onSquare.get(token.position) ?? []), token]);
  }
  const waiting = tokens.filter((t) => t.position <= 0);
  return tokens.map((token) => {
    if (token.position <= 0) {
      return { token, x: 6 + waiting.indexOf(token) * 8, y: 105 };
    }
    const group = onSquare.get(token.position)!;
    const [ox, oy] = SHARED_OFFSETS[Math.min(group.length, 4)][group.indexOf(token) % 4];
    const { x, y } = center(token.position);
    return { token, x: x + ox, y: y + oy };
  });
}

export function SnlBoard({ tokens, highlight }: { tokens: BoardToken[]; highlight?: number | null }) {
  return (
    <div className="relative w-full" style={{ aspectRatio: `100 / ${BOARD_HEIGHT}` }} aria-hidden data-testid="snl-board">
      <div className="absolute inset-x-0 top-0 aspect-square overflow-hidden rounded-2xl border border-emerald-300/20 bg-emerald-950 shadow-2xl shadow-emerald-950/50">
        <div className="grid size-full grid-cols-10 grid-rows-10">
          {Array.from({ length: 100 }, (_, i) => {
            const row = Math.floor(i / BOARD_COLUMNS);
            const col = i % BOARD_COLUMNS;
            const square = squareAt(row, col);
            return (
              <div
                key={square}
                className={cn(
                  "relative transition-colors duration-300",
                  (row + col) % 2 === 0 ? "bg-emerald-900/70" : "bg-teal-950/80",
                  square === highlight && "bg-amber-300/30",
                )}
              >
                <span className="absolute top-[6%] left-[8%] text-[clamp(7px,1.6vw,11px)] font-semibold text-white/45 tabular-nums">
                  {square}
                </span>
                {square === FINAL_SQUARE && <span className="absolute inset-0 grid place-items-center text-[clamp(12px,3.4vw,22px)]">🏁</span>}
              </div>
            );
          })}
        </div>
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full">
          {Object.entries(LADDERS).map(([from, to]) => (
            <Ladder key={`l${from}`} from={Number(from)} to={to} />
          ))}
          {Object.entries(SNAKES).map(([head, tail], i) => (
            <Snake key={`s${head}`} head={Number(head)} tail={tail} color={SNAKE_COLORS[i % SNAKE_COLORS.length]} />
          ))}
        </svg>
      </div>

      <span className="absolute bottom-[1.5%] text-[10px] font-semibold tracking-wider text-zinc-500 uppercase" style={{ left: `${6 + tokens.filter((t) => t.position <= 0).length * 8}%` }}>
        {tokens.some((t) => t.position <= 0) ? "← Start" : ""}
      </span>

      {tokenPoints(tokens).map(({ token, x, y }) => (
        <div
          key={token.id}
          data-testid={`token-${token.id}`}
          data-position={token.position}
          className={cn(
            "absolute z-10 grid aspect-square w-[6.4%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-[clamp(8px,1.8vw,12px)] font-black text-ink-950 shadow-[0_4px_10px_rgb(0_0_0/0.5)]",
            token.active && "z-20 ring-4 ring-white/40",
          )}
          style={{
            left: `${x}%`,
            top: `${(y / BOARD_HEIGHT) * 100}%`,
            backgroundColor: token.color,
            transition: token.jumping
              ? "left 650ms ease-in-out, top 650ms ease-in-out"
              : "left 150ms ease-out, top 150ms ease-out",
          }}
        >
          {token.label}
        </div>
      ))}
    </div>
  );
}
