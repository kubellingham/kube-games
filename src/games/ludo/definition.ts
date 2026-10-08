import type { GameDefinition } from "../types";

export const ludo: GameDefinition = {
  id: "ludo",
  name: "Ludo",
  tagline: "Roll, race and capture your way home.",
  description:
    "The classic race for 2–4 players. Hold the dice to spin it, bring your tokens out with a 6, capture your friends' tokens to send them back, and be first to get all four home.",
  icon: "🎲",
  showcase: ["🔴", "🟢", "🟡", "🔵"],
  category: "Board",
  players: { min: 2, max: 4 },
  modes: ["computer", "online"],
  online: { quickMatch: true, privateRooms: true },
  availability: "available",
  theme: "sky",
  howToPlay: [
    "On your turn, press and hold the dice, then let go to roll.",
    "Roll a 6 to bring a token out of your yard. A 6 also earns another roll, but three 6s in a row end your turn.",
    "Tap a glowing token to move it. If only one move is possible, it's made for you.",
    "Land on an opponent to send their token back to their yard and roll again. Stars and start squares are safe.",
    "Get all four tokens round the board and up your home column (with an exact roll) to win.",
    "Online, if a player doesn't roll or move within 30 seconds, the game plays for them.",
  ],
};
