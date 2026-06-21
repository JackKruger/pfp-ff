import { describe, expect, it } from "vitest";
import { TerrainGrid } from "../src/systems/terrain.js";

describe("raskulls terrain", () => {
  it("destroys only breakable solid tiles", () => {
    const grid = new TerrainGrid(5, 5);
    grid.set(1, 1, "dirt");
    grid.set(2, 1, "crate");
    grid.set(3, 1, "stone");

    expect(grid.destroyTile(1, 1)).toEqual({ destroyed: true, replacement: "empty" });
    expect(grid.destroyTile(2, 1)).toEqual({
      destroyed: true,
      replacement: "gem",
      pickup: "gem",
    });
    expect(grid.destroyTile(3, 1)).toEqual({ destroyed: false, replacement: "stone" });
    expect(grid.get(1, 1)).toBe("empty");
    expect(grid.get(2, 1)).toBe("gem");
    expect(grid.get(3, 1)).toBe("stone");
  });

  it("collects pickups touched by a player rectangle", () => {
    const grid = new TerrainGrid(6, 6);
    grid.set(2, 2, "gem");
    grid.set(3, 2, "dash");
    grid.set(4, 2, "stone");

    const collected = grid.collectPickups({ x: 64, y: 64, width: 64, height: 32 });

    expect(collected.map((pickup) => pickup.kind)).toEqual(["gem", "dash"]);
    expect(grid.get(2, 2)).toBe("empty");
    expect(grid.get(3, 2)).toBe("empty");
    expect(grid.get(4, 2)).toBe("stone");
  });
});
