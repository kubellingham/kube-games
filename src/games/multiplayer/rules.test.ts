import { describe, expect, it } from "vitest";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  sanitizeDisplayName,
} from "./rules";

describe("room codes", () => {
  it("normalizes user input", () => {
    expect(normalizeRoomCode(" k7f-3qx ")).toBe("K7F3QX");
  });

  it("accepts only six unambiguous characters", () => {
    expect(isValidRoomCode("K7F3QX")).toBe(true);
    expect(isValidRoomCode("K7F3Q")).toBe(false);
    expect(isValidRoomCode("K7F3QXA")).toBe(false);
    // 0, O, 1, I and L are excluded because they are easy to confuse.
    for (const ambiguous of ["0", "O", "1", "I", "L"]) {
      expect(isValidRoomCode(`K7F3Q${ambiguous}`)).toBe(false);
    }
  });

  it("generates valid codes from the alphabet", () => {
    let i = 0;
    const code = generateRoomCode((max) => i++ % max);
    expect(code).toBe(ROOM_CODE_ALPHABET.slice(0, 6));
    for (let n = 0; n < 50; n++) {
      expect(isValidRoomCode(generateRoomCode((max) => Math.floor(Math.random() * max)))).toBe(true);
    }
  });
});

describe("sanitizeDisplayName", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeDisplayName("  Ada   Lovelace ")).toBe("Ada Lovelace");
  });

  it("removes control and formatting characters", () => {
    expect(sanitizeDisplayName("Ada\u0000​‮")).toBe("Ada");
  });

  it("limits the length without splitting emoji", () => {
    const name = sanitizeDisplayName("🎮".repeat(30));
    expect(Array.from(name ?? "")).toHaveLength(24);
  });

  it.each([undefined, null, 42, "", "   ", "​"])("rejects %j", (raw) => {
    expect(sanitizeDisplayName(raw)).toBeNull();
  });
});
