import { describe, expect, it } from "vitest";
import { rankArenaPlayers, rankRacePlayers } from "../src/systems/scoring.js";
import {
  applyGrandPrixRound,
  createGrandPrixState,
  rankGrandPrix,
} from "../src/systems/playlist.js";
import { rankChallengePlayers } from "../src/systems/challenges.js";
import type { PlayerStats, RankedPlayer } from "../src/systems/types.js";

describe("raskulls scoring", () => {
  it("ranks race finishers before timeouts by finish time", () => {
    const ranked = rankRacePlayers(
      [
        racePlayer(0, { finishMs: 35_000, gems: 1 }),
        racePlayer(1, { progress: 900, gems: 9 }),
        racePlayer(2, { finishMs: 28_000 }),
      ],
      120_000,
    );

    expect(ranked.map((player) => [player.slot, player.rank])).toEqual([
      [2, 1],
      [0, 2],
      [1, 3],
    ]);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it("ranks race timeouts by progress, gems, then blocks", () => {
    const ranked = rankRacePlayers(
      [
        racePlayer(0, { progress: 500, gems: 2, blocksBroken: 8 }),
        racePlayer(1, { progress: 900, gems: 0, blocksBroken: 0 }),
        racePlayer(2, { progress: 500, gems: 3, blocksBroken: 1 }),
      ],
      120_000,
    );

    expect(ranked.map((player) => player.slot)).toEqual([1, 2, 0]);
  });

  it("gems and blocks are tiebreakers, not primary rank criteria in race", () => {
    // Player 0 has many gems but worse progress — should rank lower
    const ranked = rankRacePlayers(
      [
        racePlayer(0, { progress: 200, gems: 99, blocksBroken: 99 }),
        racePlayer(1, { progress: 800, gems: 0, blocksBroken: 0 }),
      ],
      120_000,
    );
    expect(ranked[0]?.slot).toBe(1); // higher progress wins
    expect(ranked[1]?.slot).toBe(0);
  });

  it("ranks arena by lives, eliminations, gems, and fewer deaths", () => {
    const ranked = rankArenaPlayers([
      arenaPlayer(0, { lives: 1, eliminations: 3, gems: 1, deaths: 2 }),
      arenaPlayer(1, { lives: 2, eliminations: 0, gems: 0, deaths: 1 }),
      arenaPlayer(2, { lives: 1, eliminations: 3, gems: 2, deaths: 1 }),
      arenaPlayer(3, { lives: 0, alive: false, eliminations: 4, gems: 9, deaths: 3 }),
    ]);

    expect(ranked.map((player) => [player.slot, player.rank])).toEqual([
      [1, 1],
      [2, 2],
      [0, 3],
      [3, 4],
    ]);
  });
});

describe("grand prix playlist scoring", () => {
  it("awards 5/3/2/1 points for 1st/2nd/3rd/4th place", () => {
    const state = createGrandPrixState(
      ["a"],
      [
        { slot: 0, profileId: "p0" },
        { slot: 1, profileId: "p1" },
        { slot: 2, profileId: "p2" },
        { slot: 3, profileId: "p3" },
      ],
    );
    applyGrandPrixRound(state, [
      gp(0, 1, 10_000),
      gp(1, 2, 12_000),
      gp(2, 3, 14_000),
      gp(3, 4, 16_000),
    ]);
    const results = rankGrandPrix(state);
    const bySlot = Object.fromEntries(results.map((r) => [r.slot, r.score]));
    expect(bySlot[0]).toBe(5);
    expect(bySlot[1]).toBe(3);
    expect(bySlot[2]).toBe(2);
    expect(bySlot[3]).toBe(1);
  });

  it("ranks grand prix by cumulative points, not gems or blocks", () => {
    const state = createGrandPrixState(
      ["a"],
      [
        { slot: 0, profileId: "p0" },
        { slot: 1, profileId: "p1" },
      ],
    );
    // Slot 1 finishes 2nd but has way more gems — should still rank second
    applyGrandPrixRound(state, [gp(0, 1, 10_000), gp(1, 2, 12_000)]);
    // Manually inflate gems on entry for slot 1
    const entry1 = state.entries.find((e) => e.slot === 1)!;
    entry1.stats.gems = 999;
    const results = rankGrandPrix(state);
    expect(results[0]?.slot).toBe(0); // 5 pts wins over 3 pts regardless of gems
    expect(results[1]?.slot).toBe(1);
  });

  it("uses finishMs as grand prix tiebreaker when points are equal", () => {
    const state = createGrandPrixState(
      ["a"],
      [
        { slot: 0, profileId: "p0" },
        { slot: 1, profileId: "p1" },
      ],
    );
    // Both get 3 points (2nd place in separate single-player context)
    applyGrandPrixRound(state, [gp(0, 2, 20_000), gp(1, 2, 15_000)]);
    const results = rankGrandPrix(state);
    // slot 1 has better (lower) finishMs
    expect(results[0]?.slot).toBe(1);
  });
});

describe("challenge mode scoring", () => {
  it("ammo-scrooge ranks by remaining wand uses", () => {
    const results = rankChallengePlayers("ammo-scrooge", [
      { slot: 0, profileId: "p0", stats: baseStats(30_000), wandUsesRemaining: 2 },
      { slot: 1, profileId: "p1", stats: baseStats(25_000), wandUsesRemaining: 7 },
    ]);
    expect(results[0]?.slot).toBe(1); // more ammo remaining = better
    expect(results[1]?.slot).toBe(0);
  });

  it("ammo-scrooge uses finishMs as tiebreaker when uses are equal", () => {
    const results = rankChallengePlayers("ammo-scrooge", [
      { slot: 0, profileId: "p0", stats: baseStats(35_000), wandUsesRemaining: 5 },
      { slot: 1, profileId: "p1", stats: baseStats(28_000), wandUsesRemaining: 5 },
    ]);
    expect(results[0]?.slot).toBe(1); // faster finish breaks tie
  });

  it("bomb-disposal ranks by bombs cleared first", () => {
    const results = rankChallengePlayers("bomb-disposal", [
      { slot: 0, profileId: "p0", stats: baseStats(20_000), bombTargetsCleared: 1 },
      { slot: 1, profileId: "p1", stats: baseStats(90_000), bombTargetsCleared: 3 },
    ]);
    expect(results[0]?.slot).toBe(1); // more bombs cleared wins even if slower
  });

  it("frenzy-run ranks by frenzy uptime", () => {
    const results = rankChallengePlayers("frenzy-run", [
      { slot: 0, profileId: "p0", stats: baseStats(20_000), frenzyUptimeMs: 500 },
      { slot: 1, profileId: "p1", stats: baseStats(25_000), frenzyUptimeMs: 8000 },
    ]);
    expect(results[0]?.slot).toBe(1); // more frenzy uptime wins
  });

  it("time-trial ranks by finish time only", () => {
    const results = rankChallengePlayers("time-trial", [
      { slot: 0, profileId: "p0", stats: baseStats(40_000) },
      { slot: 1, profileId: "p1", stats: baseStats(30_000) },
    ]);
    expect(results[0]?.slot).toBe(1);
  });
});

function stats(patch: Partial<PlayerStats> = {}): PlayerStats {
  return {
    blocksBroken: patch.blocksBroken ?? 0,
    gems: patch.gems ?? 0,
    eliminations: patch.eliminations ?? 0,
    deaths: patch.deaths ?? 0,
    ...(patch.finishMs !== undefined ? { finishMs: patch.finishMs } : {}),
  };
}

function racePlayer(slot: number, patch: Partial<PlayerStats> & { progress?: number } = {}) {
  return {
    slot,
    profileId: `p${slot}`,
    progress: patch.progress ?? 0,
    stats: stats(patch),
  };
}

function arenaPlayer(
  slot: number,
  patch: Partial<PlayerStats> & { lives?: number; alive?: boolean } = {},
) {
  return {
    slot,
    profileId: `p${slot}`,
    lives: patch.lives ?? 1,
    alive: patch.alive ?? true,
    stats: stats(patch),
  };
}

function gp(slot: number, rank: number, finishMs: number): RankedPlayer {
  return {
    slot,
    profileId: `p${slot}`,
    rank,
    score: 0,
    stats: baseStats(finishMs),
  };
}

function baseStats(finishMs?: number): PlayerStats {
  return {
    blocksBroken: 0,
    gems: 0,
    eliminations: 0,
    deaths: 0,
    ...(finishMs !== undefined ? { finishMs } : {}),
  };
}
