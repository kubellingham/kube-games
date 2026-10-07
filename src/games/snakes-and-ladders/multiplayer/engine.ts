import { GameRuleError, type GameEngine } from "../../multiplayer/engine";
import { snakesAndLadders } from "../definition";
import { dieValue, newGame, playRoll, withoutPlayer } from "../logic/rules";
import { TURN_TIMEOUT_MS, type SnlAction, type SnlOptions, type SnlState } from "../logic/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const snlEngine: GameEngine<SnlState, null, SnlOptions, SnlAction> = {
  gameId: snakesAndLadders.id,
  minPlayers: 2,
  maxPlayers: 4,

  parseOptions() {
    return {};
  },

  parseAction(raw) {
    if (
      isRecord(raw) &&
      (raw.type === "roll" || raw.type === "claim_timeout") &&
      Number.isSafeInteger(raw.seq) &&
      (raw.seq as number) >= 0
    ) {
      return { type: raw.type, seq: raw.seq as number };
    }
    throw new GameRuleError("INVALID_ACTION", "That move isn't valid.");
  },

  start(players, _options, { now }) {
    return { state: newGame(players.map((p) => p.userId), now) };
  },

  applyAction({ state, players, random, now }, actorId, action) {
    if (state.winnerId) throw new GameRuleError("MATCH_OVER", "This game is already over.");
    if (!players.some((p) => p.userId === actorId)) {
      throw new GameRuleError("NOT_A_PLAYER", "You're not playing in this game.");
    }
    // Every roll names the roll count it was made for, so a double tap, a retry or
    // two simultaneous timeout claims can never roll twice.
    if (action.seq !== state.rollCount) {
      throw new GameRuleError("STALE_TURN", "That roll has already been played.");
    }
    if (action.type === "roll" && actorId !== state.turn) {
      throw new GameRuleError("NOT_YOUR_TURN", "Wait for your turn.");
    }
    if (action.type === "claim_timeout" && now < state.turnStartedAt + TURN_TIMEOUT_MS) {
      throw new GameRuleError("TURN_NOT_EXPIRED", "There's still time left on this turn.");
    }

    // The server rolls the die; how long the player held it is purely for show.
    const next = playRoll(state, dieValue(random), now, action.type === "claim_timeout");
    return { state: next, finished: next.winnerId !== null };
  },

  removePlayer({ state, now }, userId) {
    return { state: withoutPlayer(state, userId, now) };
  },
};
