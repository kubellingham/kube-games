import { describe, expect, it } from "vitest";
import { GAME_ENGINES } from "@/server/rooms/engines";
import { GAME_COMPONENTS } from "./game-components";
import { GAMES } from "./registry";

/** Guards the steps for adding a game: metadata, UI per mode, and server rules for online play. */
describe("game registry", () => {
  const playable = GAMES.filter((game) => game.availability === "available");

  it("has unique, URL-safe ids", () => {
    const ids = GAMES.map((game) => game.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,64}$/);
  });

  it.each(playable.map((game) => [game.id, game] as const))("%s implements every mode it lists", (_, game) => {
    expect(game.modes.length).toBeGreaterThan(0);
    const components = GAME_COMPONENTS[game.id];
    if (game.modes.includes("computer")) expect(components?.Computer).toBeDefined();
    if (game.modes.includes("online")) {
      expect(components?.Online).toBeDefined();
      expect(game.online).toBeDefined();
      const engine = GAME_ENGINES[game.id];
      expect(engine?.gameId).toBe(game.id);
      expect(engine.seats).toBeGreaterThanOrEqual(game.players.min);
      expect(engine.seats).toBeLessThanOrEqual(game.players.max);
    }
  });

  it("only registers engines for games in the library", () => {
    for (const gameId of Object.keys(GAME_ENGINES)) {
      expect(GAMES.some((game) => game.id === gameId)).toBe(true);
    }
  });
});
