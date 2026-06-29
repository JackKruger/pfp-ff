import type { Arena } from "../types.js";

/**
 * The Coop — medium maze with a low ceiling and multiple routes. Drop-through
 * ledges create branching paths; placing a hazard on the wrong floor punishes
 * the obvious route only.
 */
export const COOP: Arena = {
  id: "coop",
  name: "The Coop",
  bounds: { x: 0, y: 0, w: 1200, h: 800 },
  killLineY: 800,
  start: { x: 80, y: 720 },
  goal: { x: 1080, y: 64, w: 96, h: 96 },
  solids: [
    // Ground
    { x: 0, y: 760, w: 1200, h: 40 },
    // Left walls forming corridors
    { x: 0, y: 0, w: 16, h: 800 },
    { x: 1184, y: 0, w: 16, h: 800 },
    // Internal stacked floors leaving stairs of openings
    { x: 16, y: 600, w: 320, h: 16 },
    { x: 480, y: 600, w: 320, h: 16 },
    { x: 880, y: 600, w: 304, h: 16 },
    { x: 16, y: 440, w: 240, h: 16 },
    { x: 400, y: 440, w: 240, h: 16 },
    { x: 800, y: 440, w: 384, h: 16 },
    { x: 16, y: 280, w: 480, h: 16 },
    { x: 640, y: 280, w: 544, h: 16 },
    // Goal ledge
    { x: 1056, y: 152, w: 128, h: 16 },
  ],
  oneWaySolids: [
    // Drop-through floors letting you punch up through layers
    { x: 336, y: 600, w: 144, h: 12 },
    { x: 256, y: 440, w: 144, h: 12 },
    { x: 496, y: 280, w: 144, h: 12 },
  ],
  scorers: [
    { pieceId: "coin", x: 400, y: 520 },
    { pieceId: "coin", x: 900, y: 360 },
    { pieceId: "diamond", x: 600, y: 200 },
  ],
  noGoZones: [
    { x: 112, y: 720, r: 64 },
    { x: 1128, y: 112, r: 64 },
  ],
  bg: { top: "#451a03", bottom: "#0a0a0a" },
};
