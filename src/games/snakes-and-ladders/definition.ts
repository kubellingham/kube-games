import type { GameDefinition } from "../types";

export const snakesAndLadders: GameDefinition = {
  id: "snakes-and-ladders",
  name: "Snakes & Ladders",
  tagline: "Hold to roll. Climb high, slide low.",
  description:
    "The classic race to 100 with a twist: hold the dice to keep it spinning and let go to roll. Climb ladders, dodge snakes, and land exactly on 100 to win, against the computer or up to three friends online.",
  icon: "🐍",
  showcase: ["🎲", "🐍", "🪜"],
  category: "Board",
  players: { min: 2, max: 4 },
  modes: ["computer", "online"],
  online: { quickMatch: true, privateRooms: true },
  availability: "available",
  theme: "emerald",
  howToPlay: [
    "On your turn, press and hold the dice. It spins until you let go (or for 5 seconds at most).",
    "Move forward by the number rolled. Ladders carry you up; snakes slide you down.",
    "Roll a 6 to go again, but a third 6 in a row ends your turn without moving.",
    "Land exactly on 100 to win. If the roll is too high, you stay where you are.",
    "Online, if a player doesn't roll within 30 seconds, the game rolls for them.",
  ],
};
