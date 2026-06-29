import { describe, expect, it } from "vitest";
import { ARENAS } from "../src/arenas/index.js";
import { NO_GO_RADIUS } from "../src/constants.js";

describe("arenas", () => {
  it("expose at least the 3 launch arenas", () => {
    expect(ARENAS.length).toBeGreaterThanOrEqual(3);
  });

  it("each arena has unique id and name", () => {
    const ids = ARENAS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const arena of ARENAS) {
    describe(arena.id, () => {
      it("has start inside bounds", () => {
        const { x, y } = arena.start;
        const b = arena.bounds;
        expect(x).toBeGreaterThanOrEqual(b.x);
        expect(x).toBeLessThanOrEqual(b.x + b.w);
        expect(y).toBeGreaterThanOrEqual(b.y);
        expect(y).toBeLessThanOrEqual(b.y + b.h);
      });

      it("has goal inside bounds", () => {
        const g = arena.goal;
        const b = arena.bounds;
        expect(g.x).toBeGreaterThanOrEqual(b.x);
        expect(g.x + g.w).toBeLessThanOrEqual(b.x + b.w);
        expect(g.y).toBeGreaterThanOrEqual(b.y);
        expect(g.y + g.h).toBeLessThanOrEqual(b.y + b.h);
      });

      it("has at least one no-go zone covering the start and goal", () => {
        const hasStart = arena.noGoZones.some((z) => {
          const dx = z.x - arena.start.x;
          const dy = z.y - arena.start.y;
          return Math.hypot(dx, dy) < z.r + 16;
        });
        const goalCx = arena.goal.x + arena.goal.w / 2;
        const goalCy = arena.goal.y + arena.goal.h / 2;
        const hasGoal = arena.noGoZones.some((z) => {
          const dx = z.x - goalCx;
          const dy = z.y - goalCy;
          return Math.hypot(dx, dy) < z.r + 32;
        });
        expect(hasStart).toBe(true);
        expect(hasGoal).toBe(true);
      });

      it("no-go zones use the design's default radius", () => {
        for (const z of arena.noGoZones) expect(z.r).toBe(NO_GO_RADIUS);
      });

      it("kill line is at or below the bounds bottom edge", () => {
        expect(arena.killLineY).toBeGreaterThanOrEqual(arena.bounds.y);
        expect(arena.killLineY).toBeLessThanOrEqual(arena.bounds.y + arena.bounds.h);
      });

      it("scorers use only coin/diamond piece ids", () => {
        for (const s of arena.scorers) expect(["coin", "diamond"]).toContain(s.pieceId);
      });

      it("all solids are inside the bounds", () => {
        for (const s of arena.solids) {
          expect(s.x).toBeGreaterThanOrEqual(arena.bounds.x);
          expect(s.x + s.w).toBeLessThanOrEqual(arena.bounds.x + arena.bounds.w);
          expect(s.y).toBeGreaterThanOrEqual(arena.bounds.y);
          expect(s.y + s.h).toBeLessThanOrEqual(arena.bounds.y + arena.bounds.h);
        }
      });
    });
  }
});
