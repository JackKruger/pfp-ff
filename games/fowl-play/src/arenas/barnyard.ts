import type { Arena } from "../types.js";

/**
 * The Barnyard — wide, short. Mostly horizontal with gaps between hay bales.
 * Start at left, goal at right.
 *
 * Coordinate space is logical pixels, origin top-left.
 */
export const BARNYARD: Arena = {
  id: "barnyard",
  name: "The Barnyard",
  bounds: { x: 0, y: 0, w: 1920, h: 720 },
  killLineY: 720,
  start: { x: 64, y: 560 },
  goal: { x: 1800, y: 520, w: 96, h: 96 },
  solids: [
    // Floor segments with gaps
    { x: 0, y: 640, w: 320, h: 80 },
    { x: 480, y: 640, w: 320, h: 80 },
    { x: 960, y: 640, w: 320, h: 80 },
    { x: 1440, y: 640, w: 480, h: 80 },
    // Mid-air hay bales
    { x: 400, y: 480, w: 96, h: 32 },
    { x: 880, y: 432, w: 96, h: 32 },
    { x: 1360, y: 464, w: 96, h: 32 },
    // Right wall stub under the goal
    { x: 1760, y: 624, w: 160, h: 16 },
  ],
  scorers: [
    { pieceId: "coin", x: 720, y: 380 },
    { pieceId: "coin", x: 1200, y: 320 },
  ],
  noGoZones: [
    { x: 64, y: 560, r: 64 },
    { x: 1848, y: 568, r: 64 },
  ],
  dynamics: [
    // A tumbleweed-style sweeper that rolls across the floor gap in the middle,
    // forcing a clean read of its timing before committing to the dash.
    {
      kind: "sweeper",
      x1: 360,
      y1: 624,
      x2: 1400,
      y2: 624,
      w: 32,
      h: 32,
      periodMs: 5200,
    },
  ],
  bg: { top: "#fde68a", bottom: "#92400e" },
};
