import { describe, expect, it } from "vitest";
import {
  applyChallengeEvent,
  challengeDefinitions,
  createChallengeRuntime,
  rankChallengePlayers,
} from "../src/systems/challenges.js";
import type { PlayerStats } from "../src/systems/types.js";

describe("raskulls challenge variants", () => {
  it("defines the four priority challenge variants", () => {
    expect(challengeDefinitions().map((challenge) => challenge.id)).toEqual([
      "time-trial",
      "ammo-scrooge",
      "bomb-disposal",
      "frenzy-run",
    ]);
  });

  it("tracks limited wand uses for Ammo Scrooge", () => {
    const runtime = createChallengeRuntime("ammo-scrooge", [{ slot: 0, profileId: "p0" }]);

    expect(runtime.players[0]?.wandUsesRemaining).toBe(18);
    applyChallengeEvent(runtime, { type: "wand-used", slot: 0 });

    expect(runtime.players[0]?.wandUsesRemaining).toBe(17);
  });

  it("tracks bomb target clears for Bomb Disposal", () => {
    const runtime = createChallengeRuntime("bomb-disposal", [{ slot: 0, profileId: "p0" }]);

    expect(runtime.definition.bombTargetTiles).toHaveLength(3);
    expect(runtime.players[0]?.bombTargetsCleared).toBe(0);
    applyChallengeEvent(runtime, { type: "bomb-target-cleared", slot: 0 });
    applyChallengeEvent(runtime, { type: "bomb-target-cleared", slot: 0 });

    expect(runtime.players[0]?.bombTargetsCleared).toBe(2);
  });

  it("tracks Frenzy uptime for Frenzy Run", () => {
    const runtime = createChallengeRuntime("frenzy-run", [{ slot: 0, profileId: "p0" }]);

    applyChallengeEvent(runtime, { type: "frenzy-uptime", slot: 0, deltaMs: 320 });
    applyChallengeEvent(runtime, { type: "frenzy-uptime", slot: 0, deltaMs: 180 });

    expect(runtime.players[0]?.frenzyUptimeMs).toBe(500);
  });

  it("ranks challenge players by variant objective", () => {
    const stats = (finishMs: number): PlayerStats => ({
      blocksBroken: 0,
      gems: 0,
      eliminations: 0,
      deaths: 0,
      finishMs,
    });

    expect(
      rankChallengePlayers("time-trial", [
        { slot: 0, profileId: "p0", stats: stats(30_000) },
        { slot: 1, profileId: "p1", stats: stats(20_000) },
      ]).map((standing) => standing.slot),
    ).toEqual([1, 0]);

    expect(
      rankChallengePlayers("ammo-scrooge", [
        { slot: 0, profileId: "p0", stats: stats(20_000), wandUsesRemaining: 4 },
        { slot: 1, profileId: "p1", stats: stats(20_000), wandUsesRemaining: 7 },
      ]).map((standing) => standing.slot),
    ).toEqual([1, 0]);

    expect(
      rankChallengePlayers("bomb-disposal", [
        { slot: 0, profileId: "p0", stats: stats(20_000), bombTargetsCleared: 1 },
        { slot: 1, profileId: "p1", stats: stats(30_000), bombTargetsCleared: 3 },
      ]).map((standing) => standing.slot),
    ).toEqual([1, 0]);

    expect(
      rankChallengePlayers("frenzy-run", [
        { slot: 0, profileId: "p0", stats: stats(20_000), frenzyUptimeMs: 900 },
        { slot: 1, profileId: "p1", stats: stats(25_000), frenzyUptimeMs: 1500 },
      ]).map((standing) => standing.slot),
    ).toEqual([1, 0]);
  });
});
