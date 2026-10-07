export type GameModeId = "computer" | "online";

export type GameAvailability = "available" | "coming-soon";

/** Accent palette used for a game's card, hero and buttons. */
export type GameTheme = "violet" | "sky" | "amber" | "emerald" | "rose";

export interface GameDefinition {
  /** URL-safe id. Used in routes (`/games/[id]`) and stored on multiplayer rooms. */
  id: string;
  name: string;
  /** One-line pitch shown on the game card. */
  tagline: string;
  /** Longer description shown on the game's own page. */
  description: string;
  /** Emoji used as the game's icon/thumbnail. */
  icon: string;
  /** Emoji shown when the game is featured in the library. Defaults to `icon`. */
  showcase?: readonly string[];
  category: string;
  players: { min: number; max: number };
  modes: readonly GameModeId[];
  /** Online entry points offered by the multiplayer lobby. */
  online?: { quickMatch: boolean; privateRooms: boolean };
  availability: GameAvailability;
  theme: GameTheme;
  howToPlay?: readonly string[];
}
