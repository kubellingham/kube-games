import type { RoomSignal } from "../multiplayer/client/use-game-room";
import { MAX_HOLD_MS } from "./hold-dice";

/** What a player's browser broadcasts while rolling the dice. Cosmetic only. */
export type RollSignal = { kind: "holding" | "released"; seq: number };

/** Whether a player's latest signal says they're rolling the dice for turn `seq` right now. */
export function isRollingSignal(signal: RoomSignal | undefined, seq: number, now: number | null): boolean {
  const data = signal?.data as RollSignal | undefined;
  if (!signal || !data || now === null || data.seq !== seq) return false;
  const age = now - signal.receivedAt;
  return (data.kind === "holding" && age < MAX_HOLD_MS + 2_000) || (data.kind === "released" && age < 3_000);
}
