import type { GameDefinition } from "../types";

export const rockPaperScissors: GameDefinition = {
  id: "rock-paper-scissors",
  name: "Rock Paper Scissors",
  tagline: "The timeless duel of nerve and guesswork.",
  description:
    "Rock crushes scissors, scissors cut paper, paper covers rock. Warm up against the computer or challenge a friend online, where both moves stay sealed until you have each locked in.",
  icon: "✊",
  showcase: ["🪨", "📄", "✂️"],
  category: "Classic",
  players: { min: 2, max: 2 },
  modes: ["computer", "online"],
  online: { quickMatch: true, privateRooms: true },
  availability: "available",
  theme: "violet",
  howToPlay: [
    "Pick rock, paper or scissors.",
    "Rock beats scissors, scissors beat paper, paper beats rock.",
    "Matching moves are a draw. Online, moves are revealed only once both players have locked in.",
  ],
};
