import type { Aabb } from "../types.js";

/** Inclusive AABB overlap test. */
export function overlaps(a: Aabb, b: Aabb): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** True if `inner` is fully contained inside `outer`. */
export function contains(outer: Aabb, inner: Aabb): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

/** Distance from a point to the nearest edge of an AABB (0 if inside). */
export function distToAabb(px: number, py: number, b: Aabb): number {
  const dx = Math.max(b.x - px, 0, px - (b.x + b.w));
  const dy = Math.max(b.y - py, 0, py - (b.y + b.h));
  return Math.hypot(dx, dy);
}

/**
 * Swept AABB-vs-static-AABB. Returns the fraction of the move (0..1) at which
 * `mover` first touches `solid`, and which axis was hit. If no hit, returns
 * `null`. Movement is from (mover.x, mover.y) to (mover.x+dx, mover.y+dy).
 *
 * Adapted from the classic slab/separating-axis derivation; we use it for
 * resolving the player against static solids each substep.
 */
export interface SweptHit {
  t: number; // 0..1 fraction of move when contact occurs
  nx: -1 | 0 | 1;
  ny: -1 | 0 | 1;
}

export function sweep(mover: Aabb, dx: number, dy: number, solid: Aabb): SweptHit | null {
  // Distances to near/far edges.
  let xEnterDist: number;
  let xExitDist: number;
  if (dx > 0) {
    xEnterDist = solid.x - (mover.x + mover.w);
    xExitDist = solid.x + solid.w - mover.x;
  } else {
    xEnterDist = solid.x + solid.w - mover.x;
    xExitDist = solid.x - (mover.x + mover.w);
  }

  let yEnterDist: number;
  let yExitDist: number;
  if (dy > 0) {
    yEnterDist = solid.y - (mover.y + mover.h);
    yExitDist = solid.y + solid.h - mover.y;
  } else {
    yEnterDist = solid.y + solid.h - mover.y;
    yExitDist = solid.y - (mover.y + mover.h);
  }

  // When motion is zero on an axis, "entry" is only -∞ if the mover and solid
  // already overlap on that axis; otherwise there's no contact and we early-out.
  const xOverlap = mover.x < solid.x + solid.w && mover.x + mover.w > solid.x;
  const yOverlap = mover.y < solid.y + solid.h && mover.y + mover.h > solid.y;
  if (dx === 0 && !xOverlap) return null;
  if (dy === 0 && !yOverlap) return null;

  const xEntry = dx === 0 ? -Infinity : xEnterDist / dx;
  const xExit = dx === 0 ? Infinity : xExitDist / dx;
  const yEntry = dy === 0 ? -Infinity : yEnterDist / dy;
  const yExit = dy === 0 ? Infinity : yExitDist / dy;

  const entry = Math.max(xEntry, yEntry);
  const exit = Math.min(xExit, yExit);

  // Miss conditions
  if (entry > exit || (xEntry < 0 && yEntry < 0) || entry > 1) {
    return null;
  }

  let nx: -1 | 0 | 1 = 0;
  let ny: -1 | 0 | 1 = 0;
  if (xEntry > yEntry) {
    nx = dx > 0 ? -1 : 1;
  } else {
    ny = dy > 0 ? -1 : 1;
  }

  return { t: Math.max(entry, 0), nx, ny };
}
