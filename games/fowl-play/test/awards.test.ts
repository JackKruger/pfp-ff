import { describe, expect, it } from "vitest";
import { computeAwards } from "../src/awards.js";
import { makeEmptyPlayerScore, type Player } from "../src/types.js";

function makePlayer(slot: number, stats: Partial<Player["score"]> = {}): Player {
  return {
    slot,
    profileId: null,
    displayName: `P${slot + 1}`,
    color: "#ef4444",
    gamepadIndex: slot,
    active: true,
    score: { ...makeEmptyPlayerScore(), ...stats },
  };
}

describe("computeAwards", () => {
  it("awards the strict leader of a stat", () => {
    const players = [makePlayer(0, { killsCaused: 3 }), makePlayer(1, { killsCaused: 1 })];
    const awards = computeAwards(players);
    const menace = awards.find((a) => a.id === "menace");
    expect(menace).toBeDefined();
    expect(menace!.slot).toBe(0);
    expect(menace!.detail).toBe("3 trap kills");
  });

  it("skips an award when the top value ties", () => {
    const players = [makePlayer(0, { killsCaused: 2 }), makePlayer(1, { killsCaused: 2 })];
    const awards = computeAwards(players);
    expect(awards.find((a) => a.id === "menace")).toBeUndefined();
  });

  it("never awards a zero stat", () => {
    const players = [makePlayer(0), makePlayer(1)];
    expect(computeAwards(players)).toEqual([]);
  });

  it("caps the list at max", () => {
    const players = [
      makePlayer(0, { killsCaused: 3, finishes: 5, coinsCollected: 9, loneSurvivor: 2 }),
      makePlayer(1, { selfKills: 4, deaths: 7, trapsPlaced: 6 }),
    ];
    expect(computeAwards(players, 2).length).toBe(2);
    expect(computeAwards(players).length).toBe(4);
  });

  it("uses singular units for a value of one", () => {
    const players = [makePlayer(0, { selfKills: 1 }), makePlayer(1)];
    const lemming = computeAwards(players).find((a) => a.id === "lemming");
    expect(lemming!.detail).toBe("1 own-trap death");
  });
});
