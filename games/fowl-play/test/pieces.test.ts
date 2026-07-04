import { describe, expect, it } from "vitest";
import { HAND_POOL, makePlaced, pieceAabb, PIECES } from "../src/pieces/registry.js";

describe("piece registry", () => {
  it("exposes the expanded player-handable piece library", () => {
    expect(HAND_POOL.length).toBe(21);
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

  it("swaps w/h at rot 1 (90° CW)", () => {
    const placed = makePlaced(1, "plank", 100, 200, 1, 0);
    const a = pieceAabb(placed);
    expect(a.w).toBe(16);
    expect(a.h).toBe(96);
  });

  it("preserves w/h at rot 2 (180°)", () => {
    const placed = makePlaced(1, "plank", 100, 200, 2, 0);
    const a = pieceAabb(placed);
    expect(a.w).toBe(96);
    expect(a.h).toBe(16);
  });

  it("swaps w/h at rot 3 (270°)", () => {
    const placed = makePlaced(1, "plank", 100, 200, 3, 0);
    const a = pieceAabb(placed);
    expect(a.w).toBe(16);
    expect(a.h).toBe(96);
  });
});

describe("makePlaced", () => {
  it("returns the constructor fields verbatim", () => {
    const p = makePlaced(42, "saw", 100, 50, 2, 3);
    expect(p).toEqual({
      uid: 42,
      pieceId: "saw",
      x: 100,
      y: 50,
      rot: 2,
      placedBy: 3,
      placedRound: 0,
    });
  });
});

describe("HAND_POOL", () => {
  it("contains no scorer pieces", () => {
    for (const id of HAND_POOL) {
      expect(PIECES[id].category).not.toBe("scorer");
    }
  });

  it("includes at least one piece from every player-facing category", () => {
    const cats = new Set(HAND_POOL.map((id) => PIECES[id].category));
    expect(cats.has("platform")).toBe(true);
    expect(cats.has("hazard")).toBe(true);
    expect(cats.has("mover")).toBe(true);
    expect(cats.has("helper")).toBe(true);
    expect(cats.has("modifier")).toBe(true);
  });
});
