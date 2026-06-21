import { describe, expect, it } from "vitest";
import { rankArenaPlayers, rankRacePlayers } from "../src/systems/scoring.js";
import type { PlayerStats } from "../src/systems/types.js";

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
