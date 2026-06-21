import { describe, expect, it } from "vitest";
import {
  advanceGrandPrixRound,
  applyGrandPrixRound,
  createGrandPrixState,
  currentGrandPrixLevelId,
  hasNextGrandPrixRound,
  rankGrandPrix,
} from "../src/systems/playlist.js";
import type { RankedPlayer } from "../src/systems/types.js";

describe("raskulls grand prix playlist", () => {
  it("tracks the current level and advances through the playlist", () => {
    const state = createGrandPrixState(["a", "b", "c"], [{ slot: 0, profileId: "p0" }]);

    expect(currentGrandPrixLevelId(state)).toBe("a");
    expect(hasNextGrandPrixRound(state)).toBe(true);

    advanceGrandPrixRound(state);
    expect(currentGrandPrixLevelId(state)).toBe("b");

    advanceGrandPrixRound(state);
    expect(currentGrandPrixLevelId(state)).toBe("c");
    expect(hasNextGrandPrixRound(state)).toBe(false);
  });

  it("awards round points by placement and ranks total standings", () => {
    const state = createGrandPrixState(
      ["a", "b"],
      [
        { slot: 0, profileId: "p0" },
        { slot: 1, profileId: "p1" },
      ],
    );

    applyGrandPrixRound(state, [ranked(0, 1, 10_000), ranked(1, 2, 12_000)]);
    applyGrandPrixRound(state, [ranked(1, 1, 11_000), ranked(0, 2, 9_000)]);

    expect(rankGrandPrix(state).map((standing) => [standing.slot, standing.score])).toEqual([
      [0, 8],
      [1, 8],
    ]);
    expect(rankGrandPrix(state)[0]?.slot).toBe(0);
  });
});

function ranked(slot: number, rank: number, finishMs: number): RankedPlayer {
  return {
    slot,
    profileId: `p${slot}`,
    rank,
    score: 0,
    stats: {
      blocksBroken: slot,
      gems: slot,
      eliminations: 0,
      deaths: 0,
      finishMs,
    },
  };
}
