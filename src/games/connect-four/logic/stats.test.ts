import { describe, expect, it } from "vitest";
import { EMPTY_STATS, gamesPlayed, parseStats, recordOutcome } from "./stats";

describe("stats", () => {
  it("counts wins, losses and draws", () => {
    let stats = recordOutcome(EMPTY_STATS, "win");
    stats = recordOutcome(stats, "loss");
    stats = recordOutcome(stats, "draw");
    stats = recordOutcome(stats, "win");
    expect(stats).toEqual({ wins: 2, losses: 1, draws: 1 });
    expect(gamesPlayed(stats)).toBe(4);
  });

  it("restores saved stats and ignores anything malformed", () => {
    expect(parseStats(JSON.stringify({ wins: 3, losses: 2, draws: 1 }))).toEqual({ wins: 3, losses: 2, draws: 1 });
    for (const raw of [null, "", "nope", "[]", "null", '{"wins":-1,"losses":0,"draws":0}', '{"wins":1.5,"losses":0,"draws":0}', '{"wins":1}']) {
      expect(parseStats(raw)).toEqual(EMPTY_STATS);
    }
  });
});
