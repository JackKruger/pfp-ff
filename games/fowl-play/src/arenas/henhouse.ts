import type { Arena } from "../types.js";

/**
 * The Henhouse — wide, low-ceiling, dense pre-built platforming. Players
 * thread between perches; the two one-way ledges in the middle let you drop
 * down on someone but also become a one-way trap if a saw is placed below.
 */
export const HENHOUSE: Arena = {
  id: "henhouse",
  name: "The Henhouse",
  bounds: { x: 0, y: 0, w: 1600, h: 700 },
  killLineY: 700,
  start: { x: 80, y: 600 },
  goal: { x: 1480, y: 80, w: 96, h: 96 },
  solids: [
    // Ground
    { x: 0, y: 640, w: 1600, h: 60 },
    // Low perches (climbing path)
    { x: 240, y: 520, w: 160, h: 16 },
    { x: 520, y: 440, w: 160, h: 16 },
    { x: 800, y: 360, w: 160, h: 16 },
    { x: 1080, y: 280, w: 160, h: 16 },
    { x: 1360, y: 200, w: 160, h: 16 },
    // Goal ledge (fits within arena bounds: x + w ≤ 1600)
    { x: 1448, y: 176, w: 152, h: 16 },
    // Roof beams (low ceiling pressure)
    { x: 0, y: 0, w: 1600, h: 24 },
  ],
  oneWaySolids: [
    // Drop-through ledges that let you take the high road
    { x: 360, y: 360, w: 240, h: 12 },
    { x: 920, y: 200, w: 240, h: 12 },
  ],
  scorers: [
    { pieceId: "coin", x: 600, y: 380 },
    { pieceId: "coin", x: 1140, y: 220 },
  ],
  noGoZones: [
    { x: 112, y: 600, r: 64 },
    { x: 1528, y: 128, r: 64 },
  ],
  bg: { top: "#7c2d12", bottom: "#1c1917" },
};
