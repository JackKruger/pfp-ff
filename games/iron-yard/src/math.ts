export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const clone = (a: Vec3): Vec3 => ({ x: a.x, y: a.y, z: a.z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x, y: a.y + b.y, z: a.z + b.z,
});
export const sub = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x, y: a.y - b.y, z: a.z - b.z,
});
export const scale = (a: Vec3, s: number): Vec3 => ({
  x: a.x * s, y: a.y * s, z: a.z * s,
});
export const dot = (a: Vec3, b: Vec3): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;
export const lenSq = (a: Vec3): number => dot(a, a);
export const len = (a: Vec3): number => Math.sqrt(lenSq(a));
export const norm = (a: Vec3): Vec3 => {
  const l = len(a);
  return l > 1e-8 ? scale(a, 1 / l) : v(0, 0, 0);
};
export const clamp = (x: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, x));

export function segSegDistSq(
  p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3,
): { dSq: number; s: number; t: number } {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  let s: number, t: number;
  const EPS = 1e-8;
  if (a <= EPS && e <= EPS) {
    return { dSq: lenSq(r), s: 0, t: 0 };
  }
  if (a <= EPS) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = dot(d1, r);
    if (e <= EPS) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      if (denom !== 0) {
        s = clamp((b * f - c * e) / denom, 0, 1);
      } else {
        s = 0;
      }
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  const c1 = add(p1, scale(d1, s));
  const c2 = add(p2, scale(d2, t));
  return { dSq: lenSq(sub(c1, c2)), s, t };
}

export function segCapsuleHit(
  segA: Vec3, segB: Vec3,
  capA: Vec3, capB: Vec3,
  capRadius: number, expand = 0,
) {
  const r = capRadius + expand;
  const { dSq, s, t } = segSegDistSq(segA, segB, capA, capB);
  return { hit: dSq <= r * r, dSq, s, t };
}

export function yawFromDir(d: Vec3): number {
  return Math.atan2(-d.x, d.z);
}

export function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}