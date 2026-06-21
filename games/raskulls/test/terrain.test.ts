import { describe, expect, it } from "vitest";
import { TerrainGrid, isBreakableTile, isSolidTile } from "../src/systems/terrain.js";

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

  it("stores structured block metadata while keeping legacy tile access", () => {
    const grid = new TerrainGrid(4, 4);
    grid.setCell(1, 1, { kind: "block", color: "blue" });
    grid.setCell(2, 1, { kind: "block", color: "gray" });
    grid.setCell(3, 1, { kind: "steel" });

    expect(grid.get(1, 1)).toBe("blueBlock");
    expect(grid.get(2, 1)).toBe("grayBlock");
    expect(grid.get(3, 1)).toBe("stone");
    expect(grid.getCell(1, 1)).toEqual({ kind: "block", color: "blue" });
    expect(grid.isSolid(1, 1)).toBe(true);
    expect(grid.isBreakable(1, 1)).toBe(true);
    expect(grid.isBreakable(3, 1)).toBe(false);
  });

  it("maps old dirt and crate tiles into color-aware block cells", () => {
    const grid = new TerrainGrid(4, 4);
    grid.set(1, 1, "dirt");
    grid.set(2, 1, "crate");

    expect(grid.getCell(1, 1)).toEqual({ kind: "block", color: "yellow" });
    expect(grid.getCell(2, 1)).toEqual({
      kind: "block",
      color: "red",
      variant: "crate",
      contains: "gem",
    });
    expect(grid.get(1, 1)).toBe("yellowBlock");
    expect(grid.get(2, 1)).toBe("crate");
  });

  it("supports new block, steel, hazard, pickup, and finish tile kinds", () => {
    expect(isSolidTile("redBlock")).toBe(true);
    expect(isSolidTile("grayBlock")).toBe(true);
    expect(isSolidTile("steel")).toBe(true);
    expect(isBreakableTile("greenBlock")).toBe(true);
    expect(isBreakableTile("steel")).toBe(false);

    const grid = new TerrainGrid(5, 5);
    grid.set(1, 1, "greenBlock");
    grid.set(2, 1, "steel");
    grid.set(3, 1, "spikes");
    grid.set(4, 1, "finish");

    expect(grid.getCell(1, 1)).toEqual({ kind: "block", color: "green" });
    expect(grid.getCell(2, 1)).toEqual({ kind: "steel" });
    expect(grid.getCell(3, 1)).toEqual({ kind: "hazard", hazard: "spikes" });
    expect(grid.getCell(4, 1)).toEqual({ kind: "finish" });
  });

  it("collects pickups touched by a player rectangle", () => {
    const grid = new TerrainGrid(6, 6);
    grid.set(2, 2, "gem");
    grid.set(3, 2, "boostie");
    grid.set(4, 2, "stone");

    const collected = grid.collectPickups({ x: 64, y: 64, width: 64, height: 32 });

    expect(collected.map((pickup) => pickup.kind)).toEqual(["gem", "boostie"]);
    expect(grid.get(2, 2)).toBe("empty");
    expect(grid.get(3, 2)).toBe("empty");
    expect(grid.get(4, 2)).toBe("stone");
  });

  it("maps legacy dash tiles to boostie pickups", () => {
    const grid = new TerrainGrid(4, 4);
    grid.set(1, 1, "dash");

    expect(grid.get(1, 1)).toBe("boostie");
    expect(grid.getCell(1, 1)).toEqual({ kind: "pickup", pickup: "boostie" });
  });

  it("drops a single unsupported block into empty cells", () => {
    const grid = new TerrainGrid(4, 6);
    grid.set(1, 1, "blueBlock");
    grid.set(1, 5, "stone");

    const drops = grid.settleBlockGravity();

    expect(drops).toMatchObject([{ fromX: 1, fromY: 1, toX: 1, toY: 4, kind: "blueBlock" }]);
    expect(grid.get(1, 1)).toBe("empty");
    expect(grid.get(1, 4)).toBe("blueBlock");
  });

  it("drops stacked blocks together while preserving their order", () => {
    const grid = new TerrainGrid(4, 7);
    grid.set(2, 1, "redBlock");
    grid.set(2, 2, "greenBlock");
    grid.set(2, 6, "stone");

    const drops = grid.settleBlockGravity();

    expect(drops).toMatchObject([
      { fromX: 2, fromY: 2, toX: 2, toY: 5, kind: "greenBlock" },
      { fromX: 2, fromY: 1, toX: 2, toY: 4, kind: "redBlock" },
    ]);
    expect(grid.get(2, 4)).toBe("redBlock");
    expect(grid.get(2, 5)).toBe("greenBlock");
  });

  it("stops falling blocks on solid terrain", () => {
    const grid = new TerrainGrid(4, 6);
    grid.set(1, 1, "grayBlock");
    grid.set(1, 3, "steel");

    const drops = grid.settleBlockGravity();

    expect(drops).toMatchObject([{ fromX: 1, fromY: 1, toX: 1, toY: 2 }]);
    expect(grid.get(1, 2)).toBe("grayBlock");
    expect(grid.get(1, 3)).toBe("stone");
  });

  it("does not drop blocks through pickups, hazards, or finish tiles", () => {
    const grid = new TerrainGrid(5, 5);
    grid.set(1, 1, "yellowBlock");
    grid.set(1, 2, "gem");
    grid.set(2, 1, "yellowBlock");
    grid.set(2, 2, "spikes");
    grid.set(3, 1, "yellowBlock");
    grid.set(3, 2, "finish");

    expect(grid.settleBlockGravity()).toEqual([]);
    expect(grid.get(1, 1)).toBe("yellowBlock");
    expect(grid.get(2, 1)).toBe("yellowBlock");
    expect(grid.get(3, 1)).toBe("yellowBlock");
  });

  it("clears horizontal same-color block groups together", () => {
    const grid = new TerrainGrid(6, 4);
    grid.set(1, 1, "blueBlock");
    grid.set(2, 1, "blueBlock");
    grid.set(3, 1, "blueBlock");
    grid.set(4, 1, "redBlock");

    const destroyed = grid.destroyConnectedBlockGroup(2, 1);

    expect(destroyed.map((tile) => [tile.tileX, tile.tileY])).toEqual([
      [2, 1],
      [1, 1],
      [3, 1],
    ]);
    expect(grid.get(1, 1)).toBe("empty");
    expect(grid.get(2, 1)).toBe("empty");
    expect(grid.get(3, 1)).toBe("empty");
    expect(grid.get(4, 1)).toBe("redBlock");
  });

  it("clears vertical same-color block groups together", () => {
    const grid = new TerrainGrid(4, 6);
    grid.set(1, 1, "greenBlock");
    grid.set(1, 2, "greenBlock");
    grid.set(1, 3, "greenBlock");

    const destroyed = grid.destroyConnectedBlockGroup(1, 2);

    expect(destroyed).toHaveLength(3);
    expect(grid.get(1, 1)).toBe("empty");
    expect(grid.get(1, 2)).toBe("empty");
    expect(grid.get(1, 3)).toBe("empty");
  });

  it("clears L-shaped same-color block groups together", () => {
    const grid = new TerrainGrid(5, 5);
    grid.set(1, 1, "yellowBlock");
    grid.set(1, 2, "yellowBlock");
    grid.set(1, 3, "yellowBlock");
    grid.set(2, 3, "yellowBlock");
    grid.set(3, 3, "yellowBlock");
    grid.set(2, 2, "grayBlock");

    const destroyed = grid.destroyConnectedBlockGroup(1, 1);

    expect(destroyed).toHaveLength(5);
    expect(grid.get(1, 1)).toBe("empty");
    expect(grid.get(1, 2)).toBe("empty");
    expect(grid.get(1, 3)).toBe("empty");
    expect(grid.get(2, 3)).toBe("empty");
    expect(grid.get(3, 3)).toBe("empty");
    expect(grid.get(2, 2)).toBe("grayBlock");
  });

  it("explodes connected gray groups of four or more", () => {
    const grid = new TerrainGrid(5, 5);
    grid.set(1, 1, "grayBlock");
    grid.set(2, 1, "grayBlock");
    grid.set(1, 2, "grayBlock");
    grid.set(2, 2, "grayBlock");

    const explosions = grid.resolveGrayChainExplosions();

    expect(explosions).toHaveLength(1);
    expect(explosions[0]?.destroyed).toHaveLength(4);
    expect(grid.get(1, 1)).toBe("empty");
    expect(grid.get(2, 1)).toBe("empty");
    expect(grid.get(1, 2)).toBe("empty");
    expect(grid.get(2, 2)).toBe("empty");
  });

  it("leaves gray groups smaller than four intact", () => {
    const grid = new TerrainGrid(5, 5);
    grid.set(1, 1, "grayBlock");
    grid.set(2, 1, "grayBlock");
    grid.set(1, 2, "grayBlock");

    expect(grid.resolveGrayChainExplosions()).toEqual([]);
    expect(grid.get(1, 1)).toBe("grayBlock");
    expect(grid.get(2, 1)).toBe("grayBlock");
    expect(grid.get(1, 2)).toBe("grayBlock");
  });

  it("re-runs gray explosions after gravity creates a new group", () => {
    const grid = new TerrainGrid(7, 7);
    for (let x = 1; x <= 5; x++) grid.set(x, 6, "stone");

    grid.set(1, 4, "grayBlock");
    grid.set(2, 4, "grayBlock");
    grid.set(1, 5, "grayBlock");
    grid.set(2, 5, "grayBlock");

    grid.set(4, 1, "grayBlock");
    grid.set(4, 5, "grayBlock");
    grid.set(5, 4, "grayBlock");
    grid.set(5, 5, "grayBlock");

    const explosions = grid.resolveGrayChainExplosions();

    expect(explosions).toHaveLength(2);
    expect(explosions[0]?.destroyed).toHaveLength(4);
    expect(explosions[0]?.drops).toMatchObject([{ fromX: 4, fromY: 1, toX: 4, toY: 4 }]);
    expect(explosions[1]?.destroyed).toHaveLength(4);
    expect(grid.get(4, 4)).toBe("empty");
    expect(grid.get(4, 5)).toBe("empty");
    expect(grid.get(5, 4)).toBe("empty");
    expect(grid.get(5, 5)).toBe("empty");
  });
});
