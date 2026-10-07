import { FINAL_SQUARE } from "./board";
import type { SnlRoll } from "./types";

/** A one-line account of a roll, e.g. "Ann rolled 4 and climbed a ladder to 84!" */
export function describeRoll(roll: SnlRoll, name: string, isYou: boolean): string {
  const who = isYou ? "You" : name;
  const prefix = roll.auto ? `Out of time, so the game rolled for ${isYou ? "you" : name}. ` : "";
  const rolled = `${who} rolled ${roll.value}`;

  let text: string;
  switch (roll.outcome) {
    case "third-six":
      text = `${rolled}: a third 6 in a row, so the turn is over.`;
      break;
    case "overshoot":
      text = `${rolled} but ${isYou ? "need" : "needs"} exactly ${FINAL_SQUARE - roll.from} to finish.`;
      break;
    case "won":
      text =
        roll.via === "ladder"
          ? `${rolled}, climbed the ladder to 100 and ${isYou ? "win" : "wins"}! 🏆`
          : `${rolled} and reached 100! 🏆`;
      break;
    default:
      text =
        roll.via === "ladder"
          ? `${rolled} and climbed a ladder to ${roll.to}! 🪜`
          : roll.via === "snake"
            ? `${rolled} and slid down a snake to ${roll.to}. 🐍`
            : `${rolled} and moved to ${roll.to}.`;
  }
  const again = roll.extraTurn ? ` ${isYou ? "Roll" : `${name} rolls`} again!` : "";
  return prefix + text + again;
}
