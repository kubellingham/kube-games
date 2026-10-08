import { dieValue } from "@/lib/random";
import { GameRuleError, type GameEngine } from "../../multiplayer/engine";
import { ludo } from "../definition";
import { chooseMove } from "../logic/ai";
import { applyMove, applyRoll, newGame, playForAbsentPlayer, withoutPlayer } from "../logic/rules";
import { TOKENS_PER_PLAYER, TURN_TIMEOUT_MS, type LudoAction, type LudoOptions, type LudoState } from "../logic/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

export const ludoEngine: GameEngine<LudoState, null, LudoOptions, LudoAction> = {
  gameId: ludo.id,
  minPlayers: 2,
  maxPlayers: 4,

  parseOptions() {
    return {};
  },

  parseAction(raw) {
    if (isRecord(raw) && isCount(raw.step)) {
      if (raw.type === "roll" || raw.type === "claim_timeout") return { type: raw.type, step: raw.step };
      if (raw.type === "move" && isCount(raw.token) && raw.token < TOKENS_PER_PLAYER) {
        return { type: "move", step: raw.step, token: raw.token };
      }
    }
    throw new GameRuleError("INVALID_ACTION", "That move isn't valid.");
  },

  start(players, _options, { now }) {
    const bySeat = [...players].sort((a, b) => a.seat - b.seat);
    return { state: newGame(bySeat.map((p) => p.userId), now) };
  },

  applyAction({ state, players, random, now }, actorId, action) {
    if (state.winnerId) throw new GameRuleError("MATCH_OVER", "This game is already over.");
    if (!players.some((p) => p.userId === actorId) || !state.order.includes(actorId)) {
      throw new GameRuleError("NOT_A_PLAYER", "You're not playing in this game.");
    }
    // Every action names the step it was made for, so a double tap, a retry or two
    // simultaneous timeout claims can never apply twice.
    if (action.step !== state.step) {
      throw new GameRuleError("STALE_TURN", "That turn has already been played.");
    }

    let next: LudoState;
    if (action.type === "claim_timeout") {
      if (now < state.turnStartedAt + TURN_TIMEOUT_MS) {
        throw new GameRuleError("TURN_NOT_EXPIRED", "There's still time left on this turn.");
      }
      next = playForAbsentPlayer(state, random, now, (s) => chooseMove(s));
    } else {
      if (actorId !== state.turn) throw new GameRuleError("NOT_YOUR_TURN", "Wait for your turn.");
      if (action.type === "roll") {
        if (state.phase !== "roll") throw new GameRuleError("CHOOSE_TOKEN", "Pick a token to move first.");
        // The server rolls the die; how long the player held it is purely for show.
        next = applyRoll(state, dieValue(random), now);
      } else {
        if (state.phase !== "move") throw new GameRuleError("ROLL_FIRST", "Roll the dice first.");
        if (!state.movable.includes(action.token)) {
          throw new GameRuleError("INVALID_MOVE", "That token can't move with this roll.");
        }
        next = applyMove(state, action.token, now);
      }
    }
    return { state: next, finished: next.winnerId !== null };
  },

  removePlayer({ state, now }, userId) {
    return { state: withoutPlayer(state, userId, now) };
  },
};
