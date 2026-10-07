import "server-only";
import type { GameEngine } from "@/games/multiplayer/engine";
import { gameSupportsMode, getGame } from "@/games/registry";
import { rpsEngine } from "@/games/rock-paper-scissors/multiplayer/engine";

/** Server rules for every game that supports online play, keyed by game id. */
export const GAME_ENGINES: Readonly<Record<string, GameEngine>> = {
  [rpsEngine.gameId]: rpsEngine,
};

/** The engine for a game that is currently playable online. */
export function getOnlineEngine(gameId: string): GameEngine | undefined {
  const game = getGame(gameId);
  if (!game || !gameSupportsMode(game, "online")) return undefined;
  return GAME_ENGINES[gameId];
}
