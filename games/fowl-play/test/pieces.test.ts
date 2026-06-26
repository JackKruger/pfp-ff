import { describe, expect, it } from "vitest";
import { HAND_POOL, makePlaced, pieceAabb, PIECES } from "../src/pieces/registry.js";

describe("piece registry", () => {
  it("exposes 16 player-handable pieces", () => {
    expect(HAND_POOL.length).toBe(16);
  });

  it("every piece def has a non-zero size", () => {
    for (const id of Object.keys(PIECES) as Array<keyof typeof PIECES>) {
      const def = PIECES[id];
      expect(def.w).toBeGreaterThan(0);
      expect(def.h).toBeGreaterThan(0);
    }
  });

  it("lethal pieces are not solid (you can't stand on a saw)", () => {
    for (const def of Object.values(PIECES)) {
      if (def.lethal) expect(def.solid).toBe(false);
    }
  });

  it("scorers are not in the player hand", () => {
    for (const def of Object.values(PIECES)) {
      if (def.category === "scorer") expect(def.inHand).toBe(false);
    }
  });
});

describe("pieceAabb", () => {
  it("returns the def-shape at rotation 0", () => {
    const placed = makePlaced(1, "plank", 100, 200, 0, 0);
    const a = pieceAabb(placed);
    expect(a).toEqual({ x: 100, y: 200, w: 96, h: 16 });
  });

  it("swaps w/h at 90° rotations", () => {
    const placed = makePlaced(1, "plank", 100, 200, 1, 0);
    const a = pieceAabb(placed);
    expect(a.w).toBe(16);
    expect(a.h).toBe(96);
  });
});
