import { describe, expect, it } from "vitest";
import { contains, distToAabb, overlaps, sweep } from "../src/physics/aabb.js";

describe("aabb", () => {
  it("overlaps detects axis-aligned intersection", () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 })).toBe(false);
    // Touching edges count as non-overlap because we use strict <.
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
  });

  it("contains tests full containment", () => {
    expect(contains({ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 10, h: 10 })).toBe(true);
    expect(contains({ x: 0, y: 0, w: 100, h: 100 }, { x: 95, y: 10, w: 10, h: 10 })).toBe(false);
  });

  it("distToAabb is zero inside, positive outside", () => {
    const b = { x: 100, y: 100, w: 100, h: 100 };
    expect(distToAabb(150, 150, b)).toBe(0);
    expect(distToAabb(50, 150, b)).toBe(50);
    expect(distToAabb(150, 50, b)).toBe(50);
  });
});

describe("sweep", () => {
  it("hits a static block moving right", () => {
    const mover = { x: 0, y: 0, w: 10, h: 10 };
    const solid = { x: 50, y: 0, w: 10, h: 10 };
    const hit = sweep(mover, 100, 0, solid);
    expect(hit).not.toBeNull();
    expect(hit?.nx).toBe(-1);
    expect(hit?.ny).toBe(0);
    expect(hit?.t).toBeCloseTo(0.4, 3);
  });

  it("misses when moving parallel", () => {
    const mover = { x: 0, y: 0, w: 10, h: 10 };
    const solid = { x: 50, y: 50, w: 10, h: 10 };
    expect(sweep(mover, 100, 0, solid)).toBeNull();
  });

  it("detects floor landing (downward sweep)", () => {
    const mover = { x: 0, y: 0, w: 10, h: 10 };
    const solid = { x: 0, y: 100, w: 100, h: 10 };
    const hit = sweep(mover, 0, 200, solid);
    expect(hit).not.toBeNull();
    expect(hit?.ny).toBe(-1);
  });
});
