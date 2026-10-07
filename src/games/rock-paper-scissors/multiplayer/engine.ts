import { GameRuleError, type GameEngine } from "../../multiplayer/engine";
import { isRpsMove, type RpsMove } from "../logic/moves";
import { getOutcome } from "../logic/rules";
import { rockPaperScissors } from "../definition";
import {
  DEFAULT_RPS_OPTIONS,
  RPS_TARGET_SCORE_CHOICES,
  type RpsAction,
  type RpsOptions,
  type RpsSecret,
  type RpsState,
} from "./types";

const HISTORY_LIMIT = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const rpsEngine: GameEngine<RpsState, RpsSecret, RpsOptions, RpsAction> = {
  gameId: rockPaperScissors.id,
  minPlayers: 2,
  maxPlayers: 2,

  parseOptions(raw) {
    if (raw === undefined || raw === null) return DEFAULT_RPS_OPTIONS;
    if (!isRecord(raw)) throw new GameRuleError("INVALID_OPTIONS", "Those match settings aren't valid.");
    const { targetScore } = raw;
    if (targetScore === undefined) return DEFAULT_RPS_OPTIONS;
    if (!RPS_TARGET_SCORE_CHOICES.includes(targetScore as number | null)) {
      throw new GameRuleError("INVALID_OPTIONS", "Choose a match length of first to 3, first to 5, or endless.");
    }
    return { targetScore: targetScore as number | null };
  },

  parseAction(raw) {
    if (
      isRecord(raw) &&
      raw.type === "submit_move" &&
      Number.isSafeInteger(raw.round) &&
      (raw.round as number) >= 1 &&
      isRpsMove(raw.move)
    ) {
      return { type: "submit_move", round: raw.round as number, move: raw.move };
    }
    throw new GameRuleError("INVALID_ACTION", "That move isn't valid.");
  },

  start(players) {
    return {
      state: {
        round: 1,
        scores: Object.fromEntries(players.map((p) => [p.userId, 0])),
        draws: 0,
        lockedIn: [],
        history: [],
        matchWinnerId: null,
      },
      secrets: Object.fromEntries(players.map((p) => [p.userId, null])),
    };
  },

  applyAction({ state, options, players, secrets }, actorId, action) {
    if (state.matchWinnerId) {
      throw new GameRuleError("MATCH_OVER", "This match is already over.");
    }
    if (!players.some((p) => p.userId === actorId)) {
      throw new GameRuleError("NOT_A_PLAYER", "You're not playing in this match.");
    }
    if (action.round !== state.round) {
      throw new GameRuleError("ROUND_MISMATCH", "That round has already finished.");
    }
    if (state.lockedIn.includes(actorId)) {
      throw new GameRuleError("ALREADY_SUBMITTED", "You've already locked in a move this round.");
    }

    const sealed: RpsSecret = { round: state.round, move: action.move };
    const lockedIn = [...state.lockedIn, actorId];

    if (lockedIn.length < players.length) {
      return { state: { ...state, lockedIn }, secrets: { [actorId]: sealed } };
    }

    // Everyone has locked in: reveal the round.
    const allSecrets = { ...secrets, [actorId]: sealed };
    const moves: Record<string, RpsMove> = {};
    for (const { userId } of players) {
      const secret = allSecrets[userId];
      if (!secret || secret.round !== state.round) {
        throw new Error(`Player ${userId} is locked in without a sealed move for round ${state.round}`);
      }
      moves[userId] = secret.move;
    }

    const [first, second] = players;
    const outcome = getOutcome(moves[first.userId], moves[second.userId]);
    const winnerId = outcome === "draw" ? null : outcome === "win" ? first.userId : second.userId;

    const scores = { ...state.scores };
    if (winnerId) scores[winnerId] = (scores[winnerId] ?? 0) + 1;

    const matchWinnerId =
      winnerId && options.targetScore !== null && scores[winnerId] >= options.targetScore
        ? winnerId
        : null;

    return {
      state: {
        round: state.round + 1,
        scores,
        draws: state.draws + (winnerId ? 0 : 1),
        lockedIn: [],
        history: [{ round: state.round, moves, winnerId }, ...state.history].slice(0, HISTORY_LIMIT),
        matchWinnerId,
      },
      // The moves are public now (in history); clear the sealed copies.
      secrets: Object.fromEntries(players.map((p) => [p.userId, null])),
      finished: matchWinnerId !== null,
    };
  },
};
