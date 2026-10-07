import { rockPaperScissors } from "./rock-paper-scissors/definition";
import type { GameDefinition, GameModeId } from "./types";

/**
 * Every game in the library, in display order.
 *
 * To add a game: create its folder under `src/games/<id>/`, add its definition
 * here, then register its implementations in `game-components.tsx` (UI for each
 * mode) and `src/server/rooms/engines.ts` (rules for online play).
 */
export const GAMES: readonly GameDefinition[] = [
  rockPaperScissors,
  {
    id: "tic-tac-toe",
    name: "Tic Tac Toe",
    tagline: "Three in a row takes the crown.",
    description: "The classic grid battle of noughts and crosses.",
    icon: "⭕",
    category: "Strategy",
    players: { min: 2, max: 2 },
    modes: ["computer", "online"],
    availability: "coming-soon",
    theme: "sky",
  },
  {
    id: "connect-four",
    name: "Connect Four",
    tagline: "Drop, stack and connect four.",
    description: "Line up four discs before your opponent does.",
    icon: "🔴",
    category: "Strategy",
    players: { min: 2, max: 2 },
    modes: ["computer", "online"],
    availability: "coming-soon",
    theme: "amber",
  },
  {
    id: "memory-match",
    name: "Memory Match",
    tagline: "Flip, remember, pair them all.",
    description: "Find every matching pair in as few turns as possible.",
    icon: "🃏",
    category: "Puzzle",
    players: { min: 1, max: 4 },
    modes: ["computer", "online"],
    availability: "coming-soon",
    theme: "emerald",
  },
];

export function getGame(gameId: string): GameDefinition | undefined {
  return GAMES.find((game) => game.id === gameId);
}

export function getPlayableGame(gameId: string): GameDefinition | undefined {
  const game = getGame(gameId);
  return game?.availability === "available" ? game : undefined;
}

export function gameSupportsMode(game: GameDefinition, mode: GameModeId): boolean {
  return game.availability === "available" && game.modes.includes(mode);
}

export function formatPlayerCount({ min, max }: GameDefinition["players"]): string {
  if (min === max) return `${min} player${min === 1 ? "" : "s"}`;
  return `${min}–${max} players`;
}
