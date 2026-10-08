import { HOME, YARD, type LudoRoll } from "./types";

/**
 * A one-line account of a roll, e.g. "Ann rolled 4 and captured Ben's token!"
 * `nameOf` gives a player's name, and `youId` the viewer, who is called "you".
 */
export function describeRoll(roll: LudoRoll, nameOf: (playerId: string) => string, youId: string | null): string {
  const isYou = roll.playerId === youId;
  const who = isYou ? "You" : nameOf(roll.playerId);
  const prefix = roll.auto ? `Out of time, so the game played for ${isYou ? "you" : who}. ` : "";
  const rolled = `${who} rolled ${roll.value}`;
  const again = roll.extraTurn ? ` ${isYou ? "Roll" : `${who} rolls`} again!` : "";

  switch (roll.outcome) {
    case "third-six":
      return `${prefix}${rolled}: a third 6 in a row, so the turn is over.`;
    case "no-move":
      return `${prefix}${rolled} but no token can move.${again}`;
    case "choosing":
      return isYou ? `${rolled}. Pick a token to move.` : `${rolled} and is choosing a token…`;
    case "left":
      return `${who} left the game.`;
    case "moved":
      break;
  }

  const move = roll.move!;
  let text: string;
  if (move.captured.length > 0) {
    const victims = [...new Set(move.captured.map((c) => c.playerId))].map((id) =>
      id === youId ? "your" : `${nameOf(id)}'s`,
    );
    const count = move.captured.length === 1 ? "token" : `${move.captured.length} tokens`;
    text = `${rolled} and captured ${victims.join(" and ")} ${count}!`;
  } else if (move.to === HOME) {
    text = `${rolled} and got a token home! 🏠`;
  } else if (move.from === YARD) {
    text = `${rolled} and brought a token out.`;
  } else {
    text = `${rolled} and moved a token.`;
  }
  return prefix + text + again;
}
