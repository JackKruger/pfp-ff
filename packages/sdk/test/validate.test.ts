import { describe, expect, it } from "vitest";
import { validateGameResult } from "../src/validate.js";
import type { GameResult } from "../src/types.js";

function goodResult(): GameResult {
  return {
    gameId: "pong",
    sessionId: "session-1",
    startedAt: 1000,
    endedAt: 2000,
    standings: [
      { slot: 0, profileId: "p1", rank: 1, score: 11 },
      { slot: 1, profileId: null, rank: 2, score: 7 },
    ],
  };
}

describe("validateGameResult", () => {
  it("accepts a well-formed result", () => {
    expect(validateGameResult(goodResult())).toEqual([]);
  });

  it("accepts a matching expected gameId and sessionId", () => {
    expect(validateGameResult(goodResult(), { gameId: "pong", sessionId: "session-1" })).toEqual(
      [],
    );
  });

  it("rejects non-objects", () => {
    expect(validateGameResult(null)).not.toEqual([]);
    expect(validateGameResult("boom")).not.toEqual([]);
  });

  it("rejects a gameId that does not match the launched game", () => {
    const errors = validateGameResult(goodResult(), { gameId: "space-invaders" });
    expect(errors.some((e) => e.includes("does not match the launched game"))).toBe(true);
  });

  it("rejects a sessionId that does not match the launched session", () => {
    const errors = validateGameResult(goodResult(), { sessionId: "other-session" });
    expect(errors.some((e) => e.includes("does not match the launched session"))).toBe(true);
  });

  it("rejects missing or empty structural fields", () => {
    expect(validateGameResult({ ...goodResult(), gameId: "" })).not.toEqual([]);
    expect(validateGameResult({ ...goodResult(), sessionId: 5 })).not.toEqual([]);
    expect(validateGameResult({ ...goodResult(), startedAt: NaN })).not.toEqual([]);
    expect(validateGameResult({ ...goodResult(), endedAt: "later" })).not.toEqual([]);
    expect(validateGameResult({ ...goodResult(), standings: [] })).not.toEqual([]);
  });

  it("rejects malformed standings entries", () => {
    const bad = goodResult();
    bad.standings[0] = { slot: -1, profileId: 7, rank: 0, score: NaN } as never;
    const errors = validateGameResult(bad);
    expect(errors).toContain("standings[0].slot must be a non-negative integer");
    expect(errors).toContain("standings[0].profileId must be a string or null");
    expect(errors).toContain("standings[0].rank must be an integer >= 1");
    expect(errors).toContain("standings[0].score must be a finite number when present");
  });

  it("allows ties and omitted scores", () => {
    const result = goodResult();
    result.standings = [
      { slot: 0, profileId: null, rank: 1 },
      { slot: 1, profileId: null, rank: 1 },
    ];
    expect(validateGameResult(result)).toEqual([]);
  });
});
