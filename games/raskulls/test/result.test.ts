import { describe, expect, it } from "vitest";
import { buildGameResult } from "../src/systems/result.js";

describe("raskulls result construction", () => {
  it("includes every launched player and match stats", () => {
    const result = buildGameResult({
      sessionId: "session-1",
      startedAt: 1_000,
      endedAt: 6_000,
      mode: "arena",
      players: [player(0, "p1"), player(1, null), player(2, "p3")],
      ranked: [ranked(2, "p3", 1), ranked(0, "p1", 2), ranked(1, null, 3)],
    });

    expect(result.gameId).toBe("raskulls");
    expect(result.standings).toHaveLength(3);
    expect(result.standings.map((standing) => standing.slot)).toEqual([0, 1, 2]);
    expect(result.standings[1]?.profileId).toBeNull();
    expect(result.standings[2]?.stats?.finishMs).toBe(0);
    expect(result.gameStats).toEqual({ mode: "arena", durationMs: 5_000 });
  });
});

function player(slot: number, profileId: string | null) {
  return {
    slot,
    profileId,
    displayName: `P${slot + 1}`,
    color: "#fff",
    gamepadIndex: slot,
  };
}

function ranked(slot: number, profileId: string | null, rank: number) {
  return {
    slot,
    profileId,
    rank,
    score: 100 - rank,
    stats: {
      blocksBroken: rank,
      gems: rank,
      eliminations: rank,
      deaths: rank,
    },
  };
}
