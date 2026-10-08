import "server-only";
import type { GameEngine } from "@/games/multiplayer/engine";
import { gameSupportsMode, getGame } from "@/games/registry";
import { c4Engine } from "@/games/connect-four/multiplayer/engine";
import { ludoEngine } from "@/games/ludo/multiplayer/engine";
import { rpsEngine } from "@/games/rock-paper-scissors/multiplayer/engine";
import { snlEngine } from "@/games/snakes-and-ladders/multiplayer/engine";

/** Server rules for every game that supports online play, keyed by game id. */
export const GAME_ENGINES: Readonly<Record<string, GameEngine>> = {
  [rpsEngine.gameId]: rpsEngine,
  [snlEngine.gameId]: snlEngine,
  [ludoEngine.gameId]: ludoEngine,
  [c4Engine.gameId]: c4Engine,
};

/** The engine for a game that is currently playable online. */
export function getOnlineEngine(gameId: string): GameEngine | undefined {
  const game = getGame(gameId);
  if (!game || !gameSupportsMode(game, "online")) return undefined;
  return GAME_ENGINES[gameId];
}
