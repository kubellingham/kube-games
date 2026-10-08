import { dropDisc, emptyBoard, winningCellsAt } from "./board";
import { COLUMNS, ROWS, type C4State, type Disc } from "./types";

export function newGame(players: readonly [string, string], firstPlayerId: string): C4State {
  if (!players.includes(firstPlayerId)) throw new Error(`${firstPlayerId} isn't playing in this game`);
  return {
    players: [players[0], players[1]],
    board: emptyBoard(),
    turn: firstPlayerId,
    firstPlayerId,
    moveCount: 0,
    lastMove: null,
    winnerId: null,
    draw: false,
    winningCells: [],
  };
}

/** Seat 0 plays Red, seat 1 Yellow. */
export function discOf(state: Pick<C4State, "players">, playerId: string): Disc {
  return state.players[1] === playerId ? "yellow" : "red";
}

export function opponentOf(state: Pick<C4State, "players">, playerId: string): string {
  return state.players[0] === playerId ? state.players[1] : state.players[0];
}

export function isGameOver(state: C4State): boolean {
  return state.winnerId !== null || state.draw;
}

/**
 * Drops the disc of whoever's turn it is into `column`. The caller checks the
 * move is allowed; an impossible move (game over, full column) throws.
 */
export function playDrop(state: C4State, column: number): C4State {
  if (isGameOver(state)) throw new Error("The game is already over");
  const playerId = state.turn;
  const dropped = dropDisc(state.board, column, discOf(state, playerId));
  if (!dropped) throw new Error(`Column ${column} is full`);

  const winningCells = winningCellsAt(dropped.board, dropped.row, column);
  const won = winningCells.length > 0;
  const moveCount = state.moveCount + 1;
  const draw = !won && moveCount >= ROWS * COLUMNS;

  return {
    ...state,
    board: dropped.board,
    turn: won || draw ? playerId : opponentOf(state, playerId),
    moveCount,
    lastMove: { row: dropped.row, column, playerId },
    winnerId: won ? playerId : null,
    draw,
    winningCells,
  };
}
