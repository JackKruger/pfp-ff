import { describe, expect, it } from "vitest";
import { createRaceLevel, raceLevelDefinitions } from "../src/systems/levels.js";

describe("raskulls level catalog", () => {
  it("defines three race levels with stable ids", () => {
    expect(raceLevelDefinitions().map((level) => level.id)).toEqual([
      "dig-rush",
      "cliff-climb",
      "gray-gambit",
    ]);
  });

  it("builds independent race level grids", () => {
    const first = createRaceLevel("dig-rush");
    const second = createRaceLevel("dig-rush");

    first.grid.set(2, 2, "redBlock");

    expect(second.grid.get(2, 2)).not.toBe("redBlock");
  });

  it("gives every race level starts, finish tiles, and a timeout", () => {
    for (const definition of raceLevelDefinitions()) {
      const level = createRaceLevel(definition.id);
      let finishTiles = 0;

      level.grid.forEachTile((_tileX, _tileY, kind) => {
        if (kind === "finish") finishTiles++;
      });

      expect(level.id).toBe(definition.id);
      expect(level.name).toBe(definition.name);
      expect(level.starts).toHaveLength(4);
      expect(level.finishX).toBeGreaterThan(0);
      expect(level.timeoutMs).toBe(definition.timeLimitMs);
      expect(finishTiles).toBeGreaterThan(0);
    }
  });

  it("includes tracks for dig walls, vertical climbing, and gray-chain shortcuts", () => {
    const digRush = createRaceLevel("dig-rush");
    const cliffClimb = createRaceLevel("cliff-climb");
    const grayGambit = createRaceLevel("gray-gambit");

    expect(digRush.grid.get(14, 15)).toBe("crate");
    expect(cliffClimb.grid.get(42, 9)).toBe("crate");
    expect(grayGambit.grid.get(29, 15)).toBe("grayBlock");
    expect(grayGambit.grid.get(50, 15)).toBe("grayBlock");
  });
});
