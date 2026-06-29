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
 * Race phase: dynamic zoom-to-fit on alive actors + start + goal. Other
 * phases: show the full arena bounds.
 */
export function targetFor(state: GameState): CameraState {
  if (state.phase === "race") return targetFromActors(state);
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
  const actors = state.actors.filter((a) => a.alive);
  const points: { x: number; y: number }[] = [
    { x: state.arena.start.x, y: state.arena.start.y },
    { x: state.arena.goal.x, y: state.arena.goal.y },
    { x: state.arena.goal.x + state.arena.goal.w, y: state.arena.goal.y + state.arena.goal.h },
  ];
  for (const a of actors) {
    points.push({ x: a.x, y: a.y });
    points.push({ x: a.x + 24, y: a.y + 24 });
  }
  const aabb = aabbOfPoints(points);
  return targetFromAabb(grow(aabb, CAM_PADDING));
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
