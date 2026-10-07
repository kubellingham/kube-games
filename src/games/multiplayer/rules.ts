/** Shared validation and timing rules for multiplayer rooms (client and server). */

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;

/**
 * How often a client in a room tells the server it is still there. The reply
 * carries the room version, so this is also the longest a client stays stale
 * if a Realtime event is ever lost.
 */
export const HEARTBEAT_INTERVAL_MS = 10_000;
/**
 * A player who has not sent a heartbeat for this long is treated as gone, e.g.
 * a waiting room whose host closed the tab can no longer be joined. Generous
 * enough to survive browsers throttling timers in background tabs.
 */
export const PLAYER_TIMEOUT_MS = 90_000;

export const DISPLAY_NAME_MAX_LENGTH = 24;

/** Uppercases and strips separators, so "k7f-3qx" becomes "K7F3QX". */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}

export function generateRoomCode(randomIndex: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomIndex(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Returns a cleaned display name, or null if nothing usable is left. */
export function sanitizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return Array.from(cleaned).slice(0, DISPLAY_NAME_MAX_LENGTH).join("").trim();
}
