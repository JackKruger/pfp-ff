import { describe, expect, it } from "vitest";
import type { LaunchContext } from "@pfp/sdk";
import { makeEmptyPlayerScore, makeFrame, makePlayers } from "../src/types.js";

describe("makeEmptyPlayerScore", () => {
  it("zeroes every numeric stat", () => {
    const s = makeEmptyPlayerScore();
    expect(s.finalScore).toBe(0);
    expect(s.roundsWon).toBe(0);
    expect(s.finishes).toBe(0);
    expect(s.deaths).toBe(0);
    expect(s.coinsCollected).toBe(0);
    expect(s.diamondsCollected).toBe(0);
    expect(s.killsCaused).toBe(0);
    expect(s.loneSurvivor).toBe(0);
    expect(s.trapsPlaced).toBe(0);
    expect(s.selfKills).toBe(0);
  });

  it("returns an empty piecesByType map", () => {
    expect(makeEmptyPlayerScore().piecesByType).toEqual({});
  });

  it("returns a fresh object per call (no shared reference)", () => {
    const a = makeEmptyPlayerScore();
    const b = makeEmptyPlayerScore();
    a.piecesByType.plank = 1;
    expect(b.piecesByType.plank).toBeUndefined();
  });
});

describe("makeFrame", () => {
  it("returns all axes zeroed and all buttons false", () => {
    const f = makeFrame(2);
    expect(f.slot).toBe(2);
    expect(f.moveX).toBe(0);
    expect(f.moveY).toBe(0);
    expect(f.jumpDown).toBe(false);
    expect(f.jumpHeld).toBe(false);
    expect(f.confirmDown).toBe(false);
    expect(f.cancelDown).toBe(false);
    expect(f.nextDown).toBe(false);
    expect(f.prevDown).toBe(false);
    expect(f.rotCwDown).toBe(false);
    expect(f.rotCcwDown).toBe(false);
    expect(f.startDown).toBe(false);
  });
});

describe("makePlayers", () => {
  it("maps a LaunchContext into starting Player entries with empty scores", () => {
    const launch: LaunchContext = {
      sessionId: "s",
      sdkVersion: "1.0.0",
      players: [
        {
          slot: 0,
          profileId: "alice",
          displayName: "Alice",
          color: "#ef4444",
          gamepadIndex: 0,
        },
        {
          slot: 1,
          profileId: null,
          displayName: "P2",
          color: "#3b82f6",
          gamepadIndex: 2,
        },
      ],
      settings: {},
    };
    const ps = makePlayers(launch);
    expect(ps.length).toBe(2);
    expect(ps[0].displayName).toBe("Alice");
    expect(ps[0].gamepadIndex).toBe(0);
    expect(ps[0].active).toBe(true);
    expect(ps[0].score.finalScore).toBe(0);
    expect(ps[1].profileId).toBeNull();
    expect(ps[1].gamepadIndex).toBe(2);
  });
});
