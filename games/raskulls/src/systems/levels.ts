import { TerrainGrid, TILE_SIZE } from "./terrain.js";
import type { Vec2 } from "./types.js";

export interface RaceLevel {
  grid: TerrainGrid;
  starts: Vec2[];
  finishX: number;
  timeoutMs: number;
}

export interface ArenaLevel {
  grid: TerrainGrid;
  starts: Vec2[];
  durationMs: number;
  lives: number;
}

export function createRaceLevel(): RaceLevel {
  const grid = new TerrainGrid(76, 22);
  addWorldBounds(grid);

  for (let x = 1; x < grid.width - 1; x++) {
    grid.set(x, 18, "dirt");
    grid.set(x, 19, "stone");
    grid.set(x, 20, "stone");
  }

  for (let x = 8; x < 17; x++) grid.set(x, 14, "dirt");
  for (let x = 24; x < 34; x++) grid.set(x, 12, "dirt");
  for (let x = 45; x < 56; x++) grid.set(x, 15, "dirt");

  addDigWall(grid, 14, 15, 3);
  addDigWall(grid, 30, 13, 5);
  addDigWall(grid, 50, 16, 3);
  addDigWall(grid, 63, 15, 4);

  grid.set(10, 13, "gem");
  grid.set(18, 17, "dash");
  grid.set(27, 11, "gem");
  grid.set(36, 17, "bomb");
  grid.set(47, 14, "gem");
  grid.set(57, 17, "shield");
  grid.set(66, 14, "gem");

  const finishTileX = 71;
  for (let y = 10; y < 18; y++) grid.set(finishTileX, y, "finish");

  return {
    grid,
    starts: [
      { x: 3 * TILE_SIZE, y: 16 * TILE_SIZE },
      { x: 4 * TILE_SIZE, y: 16 * TILE_SIZE },
      { x: 3 * TILE_SIZE, y: 14 * TILE_SIZE },
      { x: 4 * TILE_SIZE, y: 14 * TILE_SIZE },
    ],
    finishX: finishTileX * TILE_SIZE,
    timeoutMs: 120_000,
  };
}

export function createArenaLevel(): ArenaLevel {
  const grid = new TerrainGrid(36, 22);
  addWorldBounds(grid);

  for (let x = 1; x < grid.width - 1; x++) {
    grid.set(x, 19, x >= 15 && x <= 20 ? "spikes" : "stone");
    grid.set(x, 20, "stone");
  }

  for (let x = 5; x < 13; x++) grid.set(x, 15, "dirt");
  for (let x = 23; x < 31; x++) grid.set(x, 15, "dirt");
  for (let x = 13; x < 23; x++) grid.set(x, 10, "dirt");
  for (let y = 12; y < 18; y++) {
    grid.set(17, y, "crate");
    grid.set(18, y, "crate");
  }

  grid.set(7, 14, "gem");
  grid.set(28, 14, "gem");
  grid.set(16, 9, "bomb");
  grid.set(19, 9, "dash");
  grid.set(17, 11, "shield");

  return {
    grid,
    starts: [
      { x: 4 * TILE_SIZE, y: 17 * TILE_SIZE },
      { x: 31 * TILE_SIZE, y: 17 * TILE_SIZE },
      { x: 7 * TILE_SIZE, y: 13 * TILE_SIZE },
      { x: 28 * TILE_SIZE, y: 13 * TILE_SIZE },
    ],
    durationMs: 90_000,
    lives: 3,
  };
}

function addWorldBounds(grid: TerrainGrid): void {
  for (let x = 0; x < grid.width; x++) {
    grid.set(x, 0, "stone");
    grid.set(x, grid.height - 1, "stone");
  }
  for (let y = 0; y < grid.height; y++) {
    grid.set(0, y, "stone");
    grid.set(grid.width - 1, y, "stone");
  }
}

function addDigWall(grid: TerrainGrid, tileX: number, bottomTileY: number, height: number): void {
  for (let y = bottomTileY - height + 1; y <= bottomTileY; y++) {
    grid.set(tileX, y, "crate");
    grid.set(tileX + 1, y, "dirt");
  }
}
