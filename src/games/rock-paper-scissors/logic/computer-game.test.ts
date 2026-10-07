import { describe, expect, it } from "vitest";
import {
  computerGameReducer,
  initialComputerGameState,
  parseStoredStats,
  totalRounds,
} from "./computer-game";

describe("computerGameReducer", () => {
  it("records a win, loss and draw and numbers the rounds", () => {
    let state = computerGameReducer(initialComputerGameState, {
      type: "play",
      playerMove: "rock",
      computerMove: "scissors",
    });
    expect(state.lastRound).toEqual({
      round: 1,
      playerMove: "rock",
      computerMove: "scissors",
      outcome: "win",
    });

    state = computerGameReducer(state, { type: "play", playerMove: "rock", computerMove: "paper" });
    expect(state.lastRound?.outcome).toBe("lose");

    state = computerGameReducer(state, { type: "play", playerMove: "paper", computerMove: "paper" });
    expect(state.lastRound).toMatchObject({ round: 3, outcome: "draw" });

    expect(state.stats).toEqual({ wins: 1, losses: 1, draws: 1 });
    expect(totalRounds(state.stats)).toBe(3);
  });

  it("resets the score", () => {
    const played = computerGameReducer(initialComputerGameState, {
      type: "play",
      playerMove: "rock",
      computerMove: "scissors",
    });
    expect(computerGameReducer(played, { type: "reset" })).toEqual(initialComputerGameState);
  });
});

describe("parseStoredStats", () => {
  it("restores valid stats", () => {
    expect(parseStoredStats('{"wins":2,"losses":1,"draws":0}')).toEqual({ wins: 2, losses: 1, draws: 0 });
  });

  it.each([null, "", "not json", "[]", '{"wins":-1,"losses":0,"draws":0}', '{"wins":1.5,"losses":0,"draws":0}', '{"wins":1}'])(
    "rejects %s",
    (raw) => {
      expect(parseStoredStats(raw)).toBeNull();
    },
  );
});
