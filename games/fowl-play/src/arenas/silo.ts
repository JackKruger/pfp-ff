import type { Arena } from "../types.js";

/**
 * The Silo — tall, narrow. Climb from bottom to top. Pre-built ledges so a
 * skilled player can finish without any placed pieces, but only barely.
 */
export const SILO: Arena = {
  id: "silo",
  name: "The Silo",
  bounds: { x: 0, y: 0, w: 720, h: 1440 },
  killLineY: 1440,
  start: { x: 320, y: 1320 },
  goal: { x: 320, y: 64, w: 96, h: 96 },
  solids: [
    // Bottom floor
    { x: 0, y: 1360, w: 720, h: 80 },
    // Side walls (silo interior)
    { x: 0, y: 0, w: 16, h: 1440 },
    { x: 704, y: 0, w: 16, h: 1440 },
    // Ledges alternating sides
    { x: 16, y: 1200, w: 200, h: 16 },
    { x: 504, y: 1040, w: 200, h: 16 },
    { x: 16, y: 880, w: 200, h: 16 },
    { x: 504, y: 720, w: 200, h: 16 },
    { x: 16, y: 560, w: 200, h: 16 },
    { x: 504, y: 400, w: 200, h: 16 },
    { x: 240, y: 240, w: 240, h: 16 },
  ],
  scorers: [
    { pieceId: "coin", x: 600, y: 980 },
    { pieceId: "coin", x: 100, y: 500 },
    { pieceId: "diamond", x: 600, y: 360 },
  ],
  noGoZones: [
    { x: 360, y: 1320, r: 64 },
    { x: 368, y: 112, r: 64 },
  ],
};
