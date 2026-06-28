import type { Arena } from "../types.js";

/**
 * The Windmill — medium, mixed verticality. (The rotating environmental blade
 * is implemented as a custom hazard in race.ts; this file just declares the
 * static layout.)
 */
export const WINDMILL: Arena = {
  id: "windmill",
  name: "The Windmill",
  bounds: { x: 0, y: 0, w: 1600, h: 1000 },
  killLineY: 1000,
  start: { x: 96, y: 800 },
  goal: { x: 1440, y: 200, w: 96, h: 96 },
  solids: [
    // Bottom ground (full width)
    { x: 0, y: 880, w: 1600, h: 120 },
    // Stepped platforms rising right
    { x: 240, y: 760, w: 160, h: 16 },
    { x: 480, y: 680, w: 160, h: 16 },
    { x: 720, y: 600, w: 160, h: 16 },
    { x: 960, y: 520, w: 160, h: 16 },
    { x: 1200, y: 440, w: 160, h: 16 },
    // Goal ledge
    { x: 1424, y: 296, w: 176, h: 16 },
    // A small floating island near the blade hazard
    { x: 800, y: 360, w: 64, h: 16 },
  ],
  scorers: [
    { pieceId: "coin", x: 832, y: 320 },
    { pieceId: "coin", x: 600, y: 560 },
  ],
  noGoZones: [
    { x: 120, y: 824, r: 64 },
    { x: 1488, y: 248, r: 64 },
  ],
  dynamics: [
    {
      kind: "blade",
      // Pivot is up near the goal ledge, blade swings down into the platforms
      // below — risk/reward grab for the coin sitting at (832, 320).
      pivotX: 1000,
      pivotY: 240,
      length: 200,
      thickness: 16,
      periodMs: 3600,
    },
  ],
};
