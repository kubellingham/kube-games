/**
 * Server-side rules for an online game.
 *
 * Engines are pure functions over plain JSON: the room service loads the room
 * under a row lock, asks the engine what happens next, and persists the result
 * in the same transaction. Engines never touch the database or the network.
 *
 * State is split in two:
 *   - `state`: public, stored on the room, sent to every player in the room.
 *   - secrets: one value per player (e.g. a sealed move or a hand of cards),
 *     only ever sent back to that player.
 */

export interface EnginePlayer {
  userId: string;
  seat: number;
}

export interface EngineContext<State, Secret, Options> {
  state: State;
  options: Options;
  /** Players currently seated, ordered by seat. */
  players: readonly EnginePlayer[];
  secrets: Readonly<Record<string, Secret | null>>;
}

export interface EngineResult<State, Secret> {
  state: State;
  /** New secret per player. Players left out keep their current secret. */
  secrets?: Record<string, Secret | null>;
  /** True when the match is over (e.g. someone reached the target score). */
  finished?: boolean;
}

export interface GameEngine<State = unknown, Secret = unknown, Options = unknown, Action = unknown> {
  gameId: string;
  /** The room starts automatically once this many players are seated. */
  seats: number;
  /** Validates options sent when creating a room; throws GameRuleError if invalid. */
  parseOptions(raw: unknown): Options;
  /** Validates an action payload from a client; throws GameRuleError if invalid. */
  parseAction(raw: unknown): Action;
  start(players: readonly EnginePlayer[], options: Options): EngineResult<State, Secret>;
  /** Applies a validated action; throws GameRuleError when it breaks the rules. */
  applyAction(
    context: EngineContext<State, Secret, Options>,
    actorId: string,
    action: Action,
  ): EngineResult<State, Secret>;
}

/** A rejected action. The message is shown to the player as-is. */
export class GameRuleError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GameRuleError";
  }
}
