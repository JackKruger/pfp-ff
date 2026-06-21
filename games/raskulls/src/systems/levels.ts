import { TerrainGrid, TILE_SIZE, type TileKind } from "./terrain.js";
import type { RaskullsMode, Vec2 } from "./types.js";

export interface LevelDefinition {
  id: string;
  name: string;
  mode: RaskullsMode;
  objective: "finish";
  timeLimitMs: number;
  hazardRules: "race-setback" | "arena-lethal";
  build: () => RaceLevel | ArenaLevel;
}

export interface RaceLevel {
  id: string;
  name: string;
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

export const RACE_LEVELS: readonly LevelDefinition[] = [
  {
    id: "dig-rush",
    name: "Dig Rush",
    mode: "race",
    objective: "finish",
    timeLimitMs: 120_000,
    hazardRules: "race-setback",
    build: createDigRushRaceLevel,
  },
  {
    id: "cliff-climb",
    name: "Cliff Climb",
    mode: "race",
    objective: "finish",
    timeLimitMs: 130_000,
    hazardRules: "race-setback",
    build: createCliffClimbRaceLevel,
  },
  {
    id: "gray-gambit",
    name: "Gray Gambit",
    mode: "race",
    objective: "finish",
    timeLimitMs: 125_000,
    hazardRules: "race-setback",
    build: createGrayGambitRaceLevel,
  },
];

export function raceLevelDefinitions(): readonly LevelDefinition[] {
  return RACE_LEVELS;
}

export function createRaceLevel(id = RACE_LEVELS[0]!.id): RaceLevel {
  const definition = RACE_LEVELS.find((level) => level.id === id) ?? RACE_LEVELS[0]!;
  return definition.build() as RaceLevel;
}

function createDigRushRaceLevel(): RaceLevel {
  const grid = new TerrainGrid(76, 22);
  addWorldBounds(grid);

  for (let x = 1; x < grid.width - 1; x++) {
    grid.set(x, 18, "dirt");
    grid.set(x, 19, "stone");
    grid.set(x, 20, "stone");
  }

  for (let x = 8; x < 17; x++) grid.set(x, 14, "yellowBlock");
  for (let x = 24; x < 34; x++) grid.set(x, 12, "blueBlock");
  for (let x = 45; x < 56; x++) grid.set(x, 15, "greenBlock");

  addDigWall(grid, 14, 15, 3);
  addDigWall(grid, 30, 13, 5);
  addDigWall(grid, 50, 16, 3);
  addDigWall(grid, 63, 15, 4);

  grid.set(10, 13, "gem");
  grid.set(18, 17, "boostie");
  grid.set(27, 11, "gem");
  grid.set(36, 17, "bomb");
  grid.set(47, 14, "gem");
  grid.set(57, 17, "shield");
  grid.set(66, 14, "gem");

  const finishTileX = 71;
  for (let y = 10; y < 18; y++) grid.set(finishTileX, y, "finish");

  return {
    id: "dig-rush",
    name: "Dig Rush",
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

function createCliffClimbRaceLevel(): RaceLevel {
  const grid = new TerrainGrid(54, 26);
  addWorldBounds(grid);

  for (let x = 1; x < grid.width - 1; x++) {
    grid.set(x, 22, "stone");
    grid.set(x, 23, "stone");
    grid.set(x, 24, "stone");
  }

  for (let x = 8; x < 17; x++) grid.set(x, 19, "yellowBlock");
  for (let x = 15; x < 24; x++) grid.set(x, 16, "blueBlock");
  for (let x = 23; x < 33; x++) grid.set(x, 13, "greenBlock");
  for (let x = 32; x < 43; x++) grid.set(x, 10, "redBlock");

  addDigWall(grid, 12, 21, 5, "yellowBlock");
  addDigWall(grid, 22, 18, 5, "blueBlock");
  addDigWall(grid, 32, 15, 5, "greenBlock");
  addDigWall(grid, 42, 12, 4, "redBlock");

  grid.set(9, 18, "boostie");
  grid.set(18, 15, "gem");
  grid.set(28, 12, "boostie");
  grid.set(37, 9, "shield");
  grid.set(44, 9, "gem");

  const finishTileX = 48;
  for (let y = 5; y < 11; y++) grid.set(finishTileX, y, "finish");

  return {
    id: "cliff-climb",
    name: "Cliff Climb",
    grid,
    starts: [
      { x: 3 * TILE_SIZE, y: 20 * TILE_SIZE },
      { x: 4 * TILE_SIZE, y: 20 * TILE_SIZE },
      { x: 3 * TILE_SIZE, y: 18 * TILE_SIZE },
      { x: 4 * TILE_SIZE, y: 18 * TILE_SIZE },
    ],
    finishX: finishTileX * TILE_SIZE,
    timeoutMs: 130_000,
  };
}

function createGrayGambitRaceLevel(): RaceLevel {
  const grid = new TerrainGrid(70, 22);
  addWorldBounds(grid);

  for (let x = 1; x < grid.width - 1; x++) {
    grid.set(x, 18, "yellowBlock");
    grid.set(x, 19, "stone");
    grid.set(x, 20, "stone");
  }

  for (let x = 10; x < 15; x++) grid.set(x, 14, "blueBlock");
  for (let x = 24; x < 33; x++) grid.set(x, 13, "greenBlock");
  for (let x = 44; x < 55; x++) grid.set(x, 15, "redBlock");

  addDigWall(grid, 16, 17, 4, "blueBlock");
  addDigWall(grid, 38, 17, 5, "greenBlock");

  addGrayCluster(grid, 29, 15);
  grid.set(29, 11, "grayBlock");
  addGrayCluster(grid, 50, 15);
  grid.set(50, 11, "grayBlock");

  for (let x = 57; x < 63; x++) grid.set(x, 17, "spikes");

  grid.set(12, 13, "boostie");
  grid.set(22, 17, "bomb");
  grid.set(35, 12, "gem");
  grid.set(48, 14, "boostie");
  grid.set(56, 14, "shield");
  grid.set(64, 17, "gem");

  const finishTileX = 66;
  for (let y = 10; y < 18; y++) grid.set(finishTileX, y, "finish");

  return {
    id: "gray-gambit",
    name: "Gray Gambit",
    grid,
    starts: [
      { x: 3 * TILE_SIZE, y: 16 * TILE_SIZE },
      { x: 4 * TILE_SIZE, y: 16 * TILE_SIZE },
      { x: 3 * TILE_SIZE, y: 14 * TILE_SIZE },
      { x: 4 * TILE_SIZE, y: 14 * TILE_SIZE },
    ],
    finishX: finishTileX * TILE_SIZE,
    timeoutMs: 125_000,
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

function addDigWall(
  grid: TerrainGrid,
  tileX: number,
  bottomTileY: number,
  height: number,
  blockKind: TileKind = "redBlock",
): void {
  for (let y = bottomTileY - height + 1; y <= bottomTileY; y++) {
    grid.set(tileX, y, "crate");
    grid.set(tileX + 1, y, blockKind);
  }
}

function addGrayCluster(grid: TerrainGrid, tileX: number, tileY: number): void {
  grid.set(tileX, tileY, "grayBlock");
  grid.set(tileX + 1, tileY, "grayBlock");
  grid.set(tileX, tileY + 1, "grayBlock");
  grid.set(tileX + 1, tileY + 1, "grayBlock");
}
