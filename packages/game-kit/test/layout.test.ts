import { describe, expect, it } from "vitest";

import { computeSplitLayout, type Viewport } from "../src/index.js";

const SCREEN = { width: 960, height: 540 };

function totalArea(panes: Viewport[]): number {
  return panes.reduce((sum, p) => sum + p.width * p.height, 0);
}

function overlaps(a: Viewport, b: Viewport): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

describe("computeSplitLayout", () => {
  it("returns one full-screen pane for a single player", () => {
    const panes = computeSplitLayout(1, SCREEN);
    expect(panes).toEqual([{ index: 0, x: 0, y: 0, width: 960, height: 540 }]);
  });

  it("returns the expected pane count for 1..4 players", () => {
    for (const count of [1, 2, 3, 4]) {
      expect(computeSplitLayout(count, SCREEN)).toHaveLength(count);
    }
  });

  it("splits two players side-by-side (vertical divider)", () => {
    const [left, right] = computeSplitLayout(2, SCREEN);
    // Both panes are full height -> the split is on width, not stacked.
    expect(left.height).toBe(SCREEN.height);
    expect(right.height).toBe(SCREEN.height);
    expect(left.width).toBe(SCREEN.width / 2);
    expect(right.x).toBe(SCREEN.width / 2);
  });

  it("gives three players two top panes and one full-width bottom pane", () => {
    const [topLeft, topRight, bottom] = computeSplitLayout(3, SCREEN);
    expect(topLeft.width).toBe(SCREEN.width / 2);
    expect(topRight.x).toBe(SCREEN.width / 2);
    expect(bottom.width).toBe(SCREEN.width);
    expect(bottom.y).toBe(SCREEN.height / 2);
  });

  it("lays four players out in a 2x2 grid", () => {
    const panes = computeSplitLayout(4, SCREEN);
    for (const p of panes) {
      expect(p.width).toBe(SCREEN.width / 2);
      expect(p.height).toBe(SCREEN.height / 2);
    }
  });

  it.each([1, 2, 3, 4])("keeps %i panes within screen bounds and non-overlapping", (count) => {
    const panes = computeSplitLayout(count, SCREEN);
    for (const p of panes) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(SCREEN.width);
      expect(p.y + p.height).toBeLessThanOrEqual(SCREEN.height);
    }
    for (let i = 0; i < panes.length; i++) {
      for (let j = i + 1; j < panes.length; j++) {
        expect(overlaps(panes[i], panes[j])).toBe(false);
      }
    }
  });

  it("tiles the whole screen with no gap", () => {
    for (const count of [1, 2, 3, 4]) {
      expect(totalArea(computeSplitLayout(count, SCREEN))).toBe(SCREEN.width * SCREEN.height);
    }
  });

  it("insets every pane symmetrically when a gap is given", () => {
    const gap = 4;
    const [left, right] = computeSplitLayout(2, SCREEN, { gap });
    expect(left.x).toBe(gap);
    expect(left.y).toBe(gap);
    expect(left.width).toBe(SCREEN.width / 2 - gap * 2);
    expect(left.height).toBe(SCREEN.height - gap * 2);
    expect(right.x).toBe(SCREEN.width / 2 + gap);
  });

  it("assigns sequential 0-based indices", () => {
    const panes = computeSplitLayout(4, SCREEN);
    expect(panes.map((p) => p.index)).toEqual([0, 1, 2, 3]);
  });

  it("clamps out-of-range counts", () => {
    expect(computeSplitLayout(0, SCREEN)).toHaveLength(1);
    expect(computeSplitLayout(-3, SCREEN)).toHaveLength(1);
    // Above 4 falls back to the 4-pane grid.
    expect(computeSplitLayout(6, SCREEN)).toHaveLength(4);
  });
});
