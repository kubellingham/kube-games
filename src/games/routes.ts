import type { GameModeId } from "./types";

export const gameRoutes = {
  library: "/games",
  game: (gameId: string) => `/games/${gameId}`,
  computer: (gameId: string) => `/games/${gameId}/play`,
  online: (gameId: string) => `/games/${gameId}/online`,
  room: (gameId: string, code: string) => `/games/${gameId}/room/${code}`,
  mode: (gameId: string, mode: GameModeId) =>
    mode === "computer" ? gameRoutes.computer(gameId) : gameRoutes.online(gameId),
};
