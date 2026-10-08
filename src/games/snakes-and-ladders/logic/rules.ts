import { FINAL_SQUARE, jumpFrom } from "./board";
import type { SnlRoll, SnlState } from "./types";

const HISTORY_LIMIT = 12;

export function newGame(playerIds: readonly string[], now: number): SnlState {
  return {
    order: [...playerIds],
    positions: Object.fromEntries(playerIds.map((id) => [id, 0])),
    turn: playerIds[0],
    turnStartedAt: now,
    sixStreak: 0,
    rollCount: 0,
    history: [],
    winnerId: null,
  };
}

export { dieValue } from "@/lib/random";

export function nextPlayer(order: readonly string[], current: string): string {
  const index = order.indexOf(current);
  return order[(index + 1) % order.length];
}

/**
 * Plays one roll for whoever's turn it is. Rules: no 6 needed to start; a 6
 * earns another roll, but a third 6 in a row forfeits the move and the turn;
 * you must land exactly on 100, and a roll that would overshoot leaves you put.
 */
export function playRoll(state: SnlState, value: number, now: number, auto = false): SnlState {
  const playerId = state.turn;
  const from = state.positions[playerId] ?? 0;
  const streak = value === 6 ? state.sixStreak + 1 : 0;
  const seq = state.rollCount + 1;
  const base = { seq, playerId, value, from, auto };

  let roll: SnlRoll;
  if (streak === 3) {
    roll = { ...base, landed: from, to: from, via: null, outcome: "third-six", extraTurn: false };
  } else if (from + value > FINAL_SQUARE) {
    roll = { ...base, landed: from, to: from, via: null, outcome: "overshoot", extraTurn: value === 6 };
  } else {
    const landed = from + value;
    const jump = jumpFrom(landed);
    const to = jump?.to ?? landed;
    const won = to === FINAL_SQUARE;
    roll = {
      ...base,
      landed,
      to,
      via: jump?.via ?? null,
      outcome: won ? "won" : "moved",
      extraTurn: value === 6 && !won,
    };
  }

  return {
    ...state,
    positions: { ...state.positions, [playerId]: roll.to },
    turn: roll.extraTurn || roll.outcome === "won" ? playerId : nextPlayer(state.order, playerId),
    turnStartedAt: now,
    sixStreak: roll.extraTurn ? streak : 0,
    rollCount: seq,
    history: [roll, ...state.history].slice(0, HISTORY_LIMIT),
    winnerId: roll.outcome === "won" ? playerId : state.winnerId,
  };
}

/** Continues without a player who left; if it was their turn, the next player is up. */
export function withoutPlayer(state: SnlState, userId: string, now: number): SnlState {
  if (!state.order.includes(userId)) return state;
  const order = state.order.filter((id) => id !== userId);
  const positions = { ...state.positions };
  delete positions[userId];
  if (state.turn !== userId) return { ...state, order, positions };
  return {
    ...state,
    order,
    positions,
    turn: nextPlayer(state.order, userId),
    turnStartedAt: now,
    sixStreak: 0,
  };
}
