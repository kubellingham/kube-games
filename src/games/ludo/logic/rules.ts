import { dieValue } from "@/lib/random";
import { colorsFor, isSafeSquare, trackIndex } from "./board";
import {
  HOME,
  TOKENS_PER_PLAYER,
  YARD,
  type LudoCapture,
  type LudoRoll,
  type LudoState,
  type TokenStep,
} from "./types";

const HISTORY_LIMIT = 12;

export function newGame(playerIds: readonly string[], now: number): LudoState {
  const colors = colorsFor(playerIds.length);
  return {
    order: [...playerIds],
    colors: Object.fromEntries(playerIds.map((id, i) => [id, colors[i]])),
    tokens: Object.fromEntries(playerIds.map((id) => [id, Array<TokenStep>(TOKENS_PER_PLAYER).fill(YARD)])),
    turn: playerIds[0],
    phase: "roll",
    movable: [],
    turnStartedAt: now,
    sixStreak: 0,
    step: 0,
    rollCount: 0,
    history: [],
    winnerId: null,
  };
}

export function nextPlayer(order: readonly string[], current: string): string {
  const index = order.indexOf(current);
  return order[(index + 1) % order.length];
}

/** Where a token lands with this roll, or null if it can't move: leaving the yard takes a 6, and home must be reached exactly. */
export function targetStep(step: TokenStep, value: number): TokenStep | null {
  if (step === HOME) return null;
  if (step === YARD) return value === 6 ? 0 : null;
  return step + value <= HOME ? step + value : null;
}

export function movableTokens(tokens: readonly TokenStep[], value: number): number[] {
  return tokens.flatMap((step, token) => (targetStep(step, value) === null ? [] : [token]));
}

/** Opponents' tokens that a token of `playerId` landing on `to` would send home. */
export function capturesAt(state: LudoState, playerId: string, to: TokenStep): LudoCapture[] {
  const square = trackIndex(state.colors[playerId], to);
  if (square === null || isSafeSquare(square)) return [];
  return state.order.flatMap((other) =>
    other === playerId
      ? []
      : state.tokens[other].flatMap((step, token) =>
          trackIndex(state.colors[other], step) === square ? [{ playerId: other, token, from: step }] : [],
        ),
  );
}

const withRoll = (state: LudoState, roll: LudoRoll): LudoRoll[] => [roll, ...state.history].slice(0, HISTORY_LIMIT);

/**
 * Plays a roll for whoever's turn it is. A 6 earns another roll, but a third 6 in a
 * row ends the turn. If only one move is possible (or every possible move is the
 * same), it's made straight away; otherwise the player picks a token next.
 */
export function applyRoll(state: LudoState, value: number, now: number, auto = false): LudoState {
  const playerId = state.turn;
  const streak = value === 6 ? state.sixStreak + 1 : 0;
  const seq = state.rollCount + 1;
  const base = { seq, playerId, value, move: null, auto };
  const rolled = { ...state, step: state.step + 1, rollCount: seq, turnStartedAt: now, movable: [] };

  if (streak === 3) {
    const roll: LudoRoll = { ...base, outcome: "third-six", extraTurn: false };
    return { ...rolled, history: withRoll(state, roll), turn: nextPlayer(state.order, playerId), sixStreak: 0 };
  }

  const movable = movableTokens(state.tokens[playerId], value);
  if (movable.length === 0) {
    const extraTurn = value === 6;
    const roll: LudoRoll = { ...base, outcome: "no-move", extraTurn };
    return {
      ...rolled,
      history: withRoll(state, roll),
      turn: extraTurn ? playerId : nextPlayer(state.order, playerId),
      sixStreak: extraTurn ? streak : 0,
    };
  }

  const choosing: LudoState = {
    ...rolled,
    phase: "move",
    movable,
    sixStreak: streak,
    history: withRoll(state, { ...base, outcome: "choosing", extraTurn: false }),
  };
  // Tokens on the same square (e.g. all in the yard) make the same move.
  const choices = new Set(movable.map((token) => state.tokens[playerId][token]));
  return choices.size === 1 ? applyMove(choosing, movable[0], now) : choosing;
}

/**
 * Moves the current player's token by their roll, capturing any opponents on an
 * unsafe square. Capturing, reaching home or having rolled a 6 earns another roll.
 */
export function applyMove(state: LudoState, token: number, now: number, auto = false): LudoState {
  const playerId = state.turn;
  const roll = state.history[0];
  const from = state.tokens[playerId][token];
  const to = targetStep(from, roll.value)!;
  const captured = capturesAt(state, playerId, to);

  const tokens = { ...state.tokens, [playerId]: state.tokens[playerId].map((step, i) => (i === token ? to : step)) };
  for (const capture of captured) {
    tokens[capture.playerId] = tokens[capture.playerId].map((step, i) => (i === capture.token ? YARD : step));
  }
  const won = tokens[playerId].every((step) => step === HOME);
  const extraTurn = !won && (roll.value === 6 || captured.length > 0 || to === HOME);
  const moved: LudoRoll = {
    ...roll,
    outcome: "moved",
    move: { token, from, to, captured },
    extraTurn,
    auto: roll.auto || auto,
  };

  return {
    ...state,
    tokens,
    phase: "roll",
    movable: [],
    step: state.step + 1,
    turnStartedAt: now,
    history: [moved, ...state.history.slice(1)],
    winnerId: won ? playerId : null,
    turn: won || extraTurn ? playerId : nextPlayer(state.order, playerId),
    sixStreak: extraTurn ? state.sixStreak : 0,
  };
}

/**
 * Plays for a player who ran out of time: rolls if they hadn't, then moves the
 * token `choose` picks if a choice is needed.
 */
export function playForAbsentPlayer(
  state: LudoState,
  random: () => number,
  now: number,
  choose: (state: LudoState) => number,
): LudoState {
  let next = state;
  if (next.phase === "roll") next = applyRoll(next, dieValue(random), now, true);
  if (next.phase === "move") next = applyMove(next, choose(next), now, true);
  return next;
}

/** Continues without a player who left: their tokens leave the board, and if it was their turn the next player is up. */
export function withoutPlayer(state: LudoState, userId: string, now: number): LudoState {
  if (!state.order.includes(userId)) return state;
  const order = state.order.filter((id) => id !== userId);
  const tokens = { ...state.tokens };
  delete tokens[userId];
  if (state.turn !== userId) return { ...state, order, tokens };

  const history =
    state.phase === "move" ? [{ ...state.history[0], outcome: "left" as const }, ...state.history.slice(1)] : state.history;
  return {
    ...state,
    order,
    tokens,
    history,
    turn: nextPlayer(state.order, userId),
    phase: "roll",
    movable: [],
    turnStartedAt: now,
    sixStreak: 0,
    step: state.step + 1,
  };
}
