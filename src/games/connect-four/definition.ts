import type { GameDefinition } from "../types";

export const connectFour: GameDefinition = {
  id: "connect-four",
  name: "Connect Four",
  tagline: "Drop, stack and connect four.",
  description:
    "Take turns dropping discs into a seven-column grid and be the first to line up four of your colour, across, up or diagonally. Outwit a computer opponent on easy, medium or hard, or challenge a friend online and watch where they're aiming in real time.",
  icon: "🔴",
  showcase: ["🔴", "🟡", "🏆"],
  category: "Strategy",
  players: { min: 2, max: 2 },
  modes: ["computer", "online"],
  online: { quickMatch: true, privateRooms: true },
  availability: "available",
  theme: "amber",
  howToPlay: [
    "Pick a column to drop your disc in. It falls to the lowest free space.",
    "Connect four of your discs in a row (across, up and down, or diagonally) to win.",
    "Block your opponent's lines while building your own. If the grid fills up first, it's a draw.",
    "On a keyboard, use ← and → to aim and Enter to drop, or press 1–7 to drop straight into a column.",
    "Online, who goes first is decided at random each game.",
  ],
};
