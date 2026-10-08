import { COLUMNS, CONNECT, ROWS, type Board, type Disc } from "./types";

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

/** Plies looked ahead, counting the computer's own move. */
const SEARCH_DEPTH: Record<Exclude<Difficulty, "easy">, number> = { medium: 4, hard: 7 };

/** Chance that the easy computer notices it can win right now. */
const EASY_SEES_WIN = 0.5;

const SIZE = ROWS * COLUMNS;

/** Beats any heuristic score; a win `n` plies away scores WIN_SCORE - n, so faster wins rank higher. */
const WIN_SCORE = 1_000_000;

/** Centre columns first: they're in the most lines, so good moves come up sooner and prune more of the tree. */
const MOVE_ORDER = [3, 2, 4, 1, 5, 0, 6];

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

/**
 * Every run of four cells a line could occupy (69 on a 7×6 board), as flat cell
 * indexes, four per window. Internally row 0 is the bottom: index = row * COLUMNS + column.
 */
const WINDOWS = (() => {
  const cells: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      for (const [dr, dc] of DIRECTIONS) {
        const endR = r + dr * (CONNECT - 1);
        const endC = c + dc * (CONNECT - 1);
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLUMNS) continue;
        for (let k = 0; k < CONNECT; k++) cells.push((r + dr * k) * COLUMNS + c + dc * k);
      }
    }
  }
  return Int8Array.from(cells);
})();

const CENTER = Math.floor(COLUMNS / 2);

/** 1 and 2 stand for the two sides; 0 is empty. */
type Side = 1 | 2;

/**
 * A mutable copy of the board for searching: moves are played and taken back in
 * place, which is far faster than copying arrays at every node.
 */
class Position {
  readonly cells = new Int8Array(SIZE);
  readonly heights = new Int8Array(COLUMNS);
  count = 0;

  constructor(board: Board, me: Disc) {
    for (let c = 0; c < COLUMNS; c++) {
      // Stack each column from the bottom up, stopping at the first gap.
      for (let row = ROWS - 1; row >= 0; row--) {
        const disc = board[row][c];
        if (!disc) break;
        this.cells[this.heights[c] * COLUMNS + c] = disc === me ? 1 : 2;
        this.heights[c]++;
        this.count++;
      }
    }
  }

  canPlay(column: number): boolean {
    return this.heights[column] < ROWS;
  }

  play(column: number, side: Side) {
    this.cells[this.heights[column] * COLUMNS + column] = side;
    this.heights[column]++;
    this.count++;
  }

  undo(column: number) {
    this.heights[column]--;
    this.cells[this.heights[column] * COLUMNS + column] = 0;
    this.count--;
  }

  /** Whether `side` would complete a line by dropping into `column` now. */
  wins(column: number, side: Side): boolean {
    const row = this.heights[column];
    if (row >= ROWS) return false;
    // Plain loops: this runs at every node of the search, so it avoids allocating.
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const dr = DIRECTIONS[d][0];
      const dc = DIRECTIONS[d][1];
      const length = 1 + this.run(row, column, dr, dc, side) + this.run(row, column, -dr, -dc, side);
      if (length >= CONNECT) return true;
    }
    return false;
  }

  /** How many of `side`'s discs line up from next to (row, column) in one direction. */
  private run(row: number, column: number, dr: number, dc: number, side: Side): number {
    let length = 0;
    let r = row + dr;
    let c = column + dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLUMNS && this.cells[r * COLUMNS + c] === side) {
      length++;
      r += dr;
      c += dc;
    }
    return length;
  }

  /**
   * A quick guess at how good the position is for `side`: open windows with three
   * or two of its discs (and none of the opponent's) count for it, the opponent's
   * against it, plus a bonus for holding the centre column.
   */
  evaluate(side: Side): number {
    const cells = this.cells;
    let score = 0;
    for (let w = 0; w < WINDOWS.length; w += CONNECT) {
      let mine = 0;
      let theirs = 0;
      for (let k = 0; k < CONNECT; k++) {
        const cell = cells[WINDOWS[w + k]];
        if (cell === side) mine++;
        else if (cell !== 0) theirs++;
      }
      if (mine > 0 && theirs > 0) continue;
      if (mine === 3) score += 5;
      else if (mine === 2) score += 2;
      else if (theirs === 3) score -= 5;
      else if (theirs === 2) score -= 2;
    }
    for (let r = 0; r < ROWS; r++) {
      const cell = cells[r * COLUMNS + CENTER];
      if (cell === side) score += 3;
      else if (cell !== 0) score -= 3;
    }
    return score;
  }
}

/**
 * Negamax with alpha-beta pruning: the score of the position for `side`, who is
 * to move, `ply` moves below the root. Scores are fail-soft bounds outside (alpha, beta).
 */
function negamax(pos: Position, side: Side, depth: number, alpha: number, beta: number, ply: number): number {
  if (pos.count === SIZE) return 0;
  const opponent: Side = side === 1 ? 2 : 1;

  // A win on this move ends the search: nothing can be faster.
  for (const column of MOVE_ORDER) {
    if (pos.wins(column, side)) return WIN_SCORE - (ply + 1);
  }
  if (depth <= 0) return pos.evaluate(side);

  // If the opponent threatens to win, blocking is the only move worth looking at.
  // Two threats can't both be blocked: the game is lost on their next move.
  let forced = -1;
  for (const column of MOVE_ORDER) {
    if (!pos.wins(column, opponent)) continue;
    if (forced !== -1) return -(WIN_SCORE - (ply + 2));
    forced = column;
  }

  let best = -Infinity;
  for (const column of forced === -1 ? MOVE_ORDER : [forced]) {
    if (!pos.canPlay(column)) continue;
    pos.play(column, side);
    const score = -negamax(pos, opponent, depth - 1, -beta, -alpha, ply + 1);
    pos.undo(column);
    if (score > best) {
      best = score;
      if (score > alpha) {
        alpha = score;
        if (alpha >= beta) break;
      }
    }
  }
  return best;
}

/** Picks among equally good columns at random, so the computer doesn't play the same game every time. */
function pick<T>(options: readonly T[], random: () => number): T {
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
}

function bestColumns(pos: Position, depth: number): number[] {
  let best = -Infinity;
  let columns: number[] = [];
  for (const column of MOVE_ORDER) {
    if (!pos.canPlay(column)) continue;
    pos.play(column, 1);
    // Searching just below the best score so far still proves which columns tie with it.
    const floor = best === -Infinity ? -Infinity : best - 1;
    const score = -negamax(pos, 2, depth - 1, -Infinity, -floor, 1);
    pos.undo(column);
    if (score > best) {
      best = score;
      columns = [column];
    } else if (score === best) {
      columns.push(column);
    }
  }
  return columns;
}

/** Mostly random, leaning towards the middle; spots a winning move only half the time. */
function easyColumn(pos: Position, legal: number[], random: () => number): number {
  const winning = legal.filter((column) => pos.wins(column, 1));
  if (winning.length > 0 && random() < EASY_SEES_WIN) return winning[0];
  const weights = legal.map((column) => CENTER + 1 - Math.abs(CENTER - column));
  let roll = random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < legal.length; i++) {
    roll -= weights[i];
    if (roll < 0) return legal[i];
  }
  return legal[legal.length - 1];
}

/**
 * The column the computer drops its `disc` into. Easy plays loosely; medium and
 * hard search ahead (4 and 7 plies), always taking a win and blocking a threat,
 * preferring faster wins and slower losses.
 */
export function chooseComputerMove(
  board: Board,
  disc: Disc,
  difficulty: Difficulty,
  random: () => number = Math.random,
): number {
  const pos = new Position(board, disc);
  const legal = MOVE_ORDER.filter((column) => pos.canPlay(column));
  if (legal.length === 0) throw new Error("The board is full");
  if (difficulty === "easy") return easyColumn(pos, [...legal].sort((a, b) => a - b), random);

  const winning = legal.find((column) => pos.wins(column, 1));
  if (winning !== undefined) return winning;
  return pick(bestColumns(pos, SEARCH_DEPTH[difficulty]), random);
}
