import { GameRuleError, type GameEngine } from "../../multiplayer/engine";
import { connectFour } from "../definition";
import { isColumn, landingRow } from "../logic/board";
import { isGameOver, newGame, playDrop } from "../logic/rules";
import { COLUMNS, ROWS, type C4Action, type C4Options, type C4State } from "../logic/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const c4Engine: GameEngine<C4State, null, C4Options, C4Action> = {
  gameId: connectFour.id,
  minPlayers: 2,
  maxPlayers: 2,

  parseOptions() {
    return {};
  },

  parseAction(raw) {
    if (
      isRecord(raw) &&
      raw.type === "drop" &&
      typeof raw.column === "number" &&
      isColumn(raw.column) &&
      Number.isSafeInteger(raw.seq) &&
      (raw.seq as number) >= 0 &&
      (raw.seq as number) < ROWS * COLUMNS
    ) {
      return { type: "drop", column: raw.column, seq: raw.seq as number };
    }
    throw new GameRuleError("INVALID_ACTION", "That move isn't valid.");
  },

  start(players, _options, { random }) {
    const [red, yellow] = [...players].sort((a, b) => a.seat - b.seat).map((p) => p.userId);
    if (!red || !yellow || players.length !== 2) throw new Error("Connect Four needs exactly two players");
    // The server tosses a coin for who goes first, every game (rematches included).
    return { state: newGame([red, yellow], random() < 0.5 ? red : yellow) };
  },

  applyAction({ state, players }, actorId, action) {
    if (isGameOver(state)) throw new GameRuleError("MATCH_OVER", "This game is already over.");
    if (!state.players.includes(actorId) || !players.some((p) => p.userId === actorId)) {
      throw new GameRuleError("NOT_A_PLAYER", "You're not playing in this game.");
    }
    // Every drop names the move count it was made for, so a double tap or a retry can never play twice.
    if (action.seq !== state.moveCount) {
      throw new GameRuleError("STALE_MOVE", "That move has already been played.");
    }
    if (actorId !== state.turn) throw new GameRuleError("NOT_YOUR_TURN", "Wait for your turn.");
    if (landingRow(state.board, action.column) === null) {
      throw new GameRuleError("COLUMN_FULL", "That column is full. Pick another one.");
    }

    const next = playDrop(state, action.column);
    return { state: next, finished: isGameOver(next) };
  },
};
