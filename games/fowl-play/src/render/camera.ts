import {
  CAM_LERP,
  CAM_PADDING,
  CAM_ZOOM_MAX,
  CAM_ZOOM_MIN,
  LOGICAL_H,
  LOGICAL_W,
} from "../constants.js";
import type { Aabb, GameState } from "../types.js";

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export function makeCamera(): CameraState {
  return { x: 0, y: 0, zoom: 1 };
}

/**
 * Compute the desired camera (focus + zoom) given the current game state.
 * Race phase: dynamic zoom-to-fit on the racing group. Other phases: show the
 * full arena bounds.
 */
export function targetFor(state: GameState): CameraState {
  if (state.phase === "race") return targetFromActors(state);
  if (state.phase === "final") return targetFromFinal(state);
  return targetFromAabb(state.arena.bounds);
}

export function lerpCamera(current: CameraState, target: CameraState): CameraState {
  return {
    x: current.x + (target.x - current.x) * CAM_LERP,
    y: current.y + (target.y - current.y) * CAM_LERP,
    zoom: current.zoom + (target.zoom - current.zoom) * CAM_LERP,
  };
}

function targetFromActors(state: GameState): CameraState {
  const racing = state.actors.filter((a) => a.alive && !a.finished);
  const fallback = state.actors.filter((a) => a.alive || a.deathPos);
  const actors = racing.length ? racing : fallback;
  if (!actors.length) return targetFromAabb(state.arena.bounds);

  const points: { x: number; y: number }[] = [];
  for (const a of actors) {
    const x = a.alive ? a.x : (a.deathPos?.x ?? a.x);
    const y = a.alive ? a.y : (a.deathPos?.y ?? a.y);
    points.push({ x, y });
    points.push({ x: x + 24, y: y + 24 });
  }
  const aabb = aabbOfPoints(points);
  return targetFromAabb(grow(aabb, CAM_PADDING));
}

function targetFromFinal(state: GameState): CameraState {
  const winner = state.players.reduce(
    (best, p) => (!best || p.score.finalScore > best.score.finalScore ? p : best),
    state.players[0] ?? null,
  );
  const actor = winner ? state.actors.find((a) => a.slot === winner.slot) : null;
  const focusX = actor
    ? actor.alive
      ? actor.x + 12
      : (actor.deathPos?.x ?? actor.x) + 12
    : state.arena.goal.x + state.arena.goal.w / 2;
  const focusY = actor
    ? actor.alive
      ? actor.y + 12
      : (actor.deathPos?.y ?? actor.y) + 12
    : state.arena.goal.y + state.arena.goal.h / 2;
  return targetFromAabb(grow({ x: focusX - 180, y: focusY - 120, w: 360, h: 240 }, 0));
}

function targetFromAabb(aabb: Aabb): CameraState {
  const zoom = clamp(
    Math.min(LOGICAL_W / aabb.w, LOGICAL_H / aabb.h),
    CAM_ZOOM_MIN,
    CAM_ZOOM_MAX,
  );
  return {
    x: aabb.x + aabb.w / 2,
    y: aabb.y + aabb.h / 2,
    zoom,
  };
}

function aabbOfPoints(points: { x: number; y: number }[]): Aabb {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function grow(aabb: Aabb, by: number): Aabb {
  return { x: aabb.x - by, y: aabb.y - by, w: aabb.w + by * 2, h: aabb.h + by * 2 };
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}
