import type { Arena } from "../types.js";

/**
 * The Roost — sky islands with big gaps and a low kill line. Every leap is
 * commitment. The whole stage is about generous platform placement to build
 * a path for yourself while sabotaging your friends'.
 */
export const ROOST: Arena = {
  id: "roost",
  name: "The Roost",
  bounds: { x: 0, y: 0, w: 1700, h: 720 },
  killLineY: 720,
  start: { x: 96, y: 480 },
  goal: { x: 1560, y: 200, w: 96, h: 96 },
  solids: [
    // Start island (left)
    { x: 32, y: 520, w: 192, h: 16 },
    // A scatter of small sky islands the players need to chain
    { x: 320, y: 440, w: 128, h: 16 },
    { x: 560, y: 380, w: 96, h: 16 },
    { x: 760, y: 480, w: 160, h: 16 },
    { x: 1000, y: 360, w: 96, h: 16 },
    { x: 1180, y: 460, w: 128, h: 16 },
    { x: 1380, y: 320, w: 112, h: 16 },
    // Goal island (right)
    { x: 1520, y: 296, w: 168, h: 16 },
  ],
  oneWaySolids: [
    // Two flimsy drop-through clouds. Useful but risky if hazards sit below.
    { x: 480, y: 280, w: 96, h: 10 },
    { x: 1080, y: 240, w: 96, h: 10 },
  ],
  scorers: [
    { pieceId: "coin", x: 608, y: 320 },
    { pieceId: "diamond", x: 1048, y: 300 },
  ],
  noGoZones: [
    { x: 128, y: 480, r: 64 },
    { x: 1608, y: 248, r: 64 },
  ],
  dynamics: [
    // A hawk circling the middle of the sky, slashing horizontally between the
    // central sky islands. Forces a commitment to the high or low route.
    {
      kind: "sweeper",
      x1: 320,
      y1: 200,
      x2: 1380,
      y2: 200,
      w: 36,
      h: 18,
      periodMs: 6000,
    },
  ],
  bg: { top: "#0c4a6e", bottom: "#020617" },
};
