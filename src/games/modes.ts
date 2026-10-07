import type { GameModeId } from "./types";

export interface GameModeDetails {
  label: string;
  description: string;
  icon: string;
}

export const GAME_MODES: Record<GameModeId, GameModeDetails> = {
  computer: {
    label: "vs Computer",
    description: "Play solo against an AI opponent. No account or connection needed.",
    icon: "🤖",
  },
  online: {
    label: "Online",
    description: "Challenge a real person with a room code or jump into a quick match.",
    icon: "🌐",
  },
};
