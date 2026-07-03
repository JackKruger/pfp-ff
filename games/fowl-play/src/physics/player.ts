import {
  AIR_ACCEL,
  COYOTE_MS,
  FIXED_DT,
  GRAVITY,
  GROUND_ACCEL,
  GROUND_FRICTION,
  JUMP_BUFFER_MS,
  JUMP_CUT_MS,
  JUMP_CUT_VY,
  JUMP_VY,
  MAX_FALL,
  PLAYER_H,
  PLAYER_W,
  WALK_MAX,
  WALL_JUMP_VX,
  WALL_JUMP_VY,
  WALL_SLIDE_GRAVITY_MUL,
  WALL_SLIDE_MAX,
} from "../constants.js";
import { pieceAabb, PIECES } from "../pieces/registry.js";
import type { Aabb, PlacedPiece, PlayerFrame, RaceActor } from "../types.js";
import { overlaps, sweep } from "./aabb.js";

const LADDER_CLIMB_SPEED = 220;

/**
 * One fixed-timestep advance of a single race actor.
 *
 * Collides against arena solids + any solid placed piece. Hazard contact and
 * scorer pickup are handled by race.ts (which calls hazardKills/scorerHits
 * helpers) so this stays pure platforming.
 */

export interface MoveResult {
  hitGround: boolean;
  hitLeftWall: boolean;
  hitRightWall: boolean;
  hitCeiling: boolean;
  /** Per-frame friction modifier from the surface the actor is standing on. */
  groundFrictionMul: number;
}

const SLOP = 0.001;

export function stepActor(
  actor: RaceActor,
  frame: PlayerFrame,
  solids: Aabb[],
  pieces: PlacedPiece[],
  dtMs: number,
  oneWaySolids: Aabb[] = [],
): MoveResult {
  if (!actor.alive || actor.finished) {
    return {
      hitGround: false,
      hitLeftWall: false,
      hitRightWall: false,
      hitCeiling: false,
      groundFrictionMul: 1,
    };
  }

  // --- Horizontal input -----------------------------------------------------
  const wantX = clamp(frame.moveX, -1, 1);
  const grounded = actor.contact === "ground";
  const accel = grounded ? GROUND_ACCEL : AIR_ACCEL;

  if (Math.abs(wantX) > 0.05) {
    actor.vx += wantX * accel * FIXED_DT;
  } else if (grounded) {
    // Friction toward 0, scaled by the surface we're standing on (ice slides).
    const frictionMul = actor.groundFrictionMul ?? 1;
    const sign = Math.sign(actor.vx);
    actor.vx -= sign * GROUND_FRICTION * frictionMul * FIXED_DT;
    if (Math.sign(actor.vx) !== sign) actor.vx = 0;
  }
  actor.vx = clamp(actor.vx, -WALK_MAX, WALK_MAX);

  // --- Jump input + variable-cut -------------------------------------------
  actor.jumpBuffer = Math.max(0, actor.jumpBuffer - dtMs);
  if (frame.jumpDown) actor.jumpBuffer = JUMP_BUFFER_MS;
  actor.jumpHeld = frame.jumpHeld;

  const canCoyote = actor.timeSinceGrounded <= COYOTE_MS;
  const wallSide =
    actor.contact === "leftWall" ? -1 : actor.contact === "rightWall" ? 1 : 0;

  if (actor.jumpBuffer > 0 && (grounded || canCoyote)) {
    actor.vy = -JUMP_VY;
    actor.jumpBuffer = 0;
    actor.jumpAge = 0;
    actor.timeSinceGrounded = COYOTE_MS + 1; // consume coyote
  } else if (actor.jumpBuffer > 0 && wallSide !== 0) {
    actor.vy = -WALL_JUMP_VY;
    actor.vx = -wallSide * WALL_JUMP_VX;
    actor.jumpBuffer = 0;
    actor.jumpAge = 0;
  }

  if (actor.vy < 0) {
    actor.jumpAge += dtMs;
    if (!frame.jumpHeld && actor.jumpAge <= JUMP_CUT_MS && actor.vy < -JUMP_CUT_VY) {
      actor.vy = -JUMP_CUT_VY;
    }
  }

  // --- Ladder override ------------------------------------------------------
  // Ladders short-circuit gravity entirely while the actor's hitbox overlaps
  // them. moveY climbs/descends; jump kicks off normally.
  const playerBounds: Aabb = { x: actor.x, y: actor.y, w: PLAYER_W, h: PLAYER_H };
  const onLadder = pieces.some(
    (p) => p.pieceId === "ladder" && overlaps(playerBounds, pieceAabb(p)),
  );

  // Ladder control applies while descending OR while moving up at climb speed —
  // a strict `vy >= 0` check would let gravity fight the climb every other
  // frame (climb sets vy negative, which disables the ladder branch, which
  // re-enables gravity…), producing a jerky ascent. Real jumps launch faster
  // than LADDER_CLIMB_SPEED, so they still exit ladder mode.
  if (onLadder && actor.vy >= -LADDER_CLIMB_SPEED) {
    // Treat ladder hold as "ground" for jump-buffer purposes (but only if not
    // already coming down from a jump — we keep variable-cut intact).
    actor.timeSinceGrounded = 0;
    if (Math.abs(frame.moveY) > 0.05) {
      actor.vy = frame.moveY * LADDER_CLIMB_SPEED;
    } else {
      actor.vy = 0;
    }
  } else {
    // --- Gravity ------------------------------------------------------------
    const slidingWall =
      wallSide !== 0 && actor.vy > 0 && Math.sign(wantX) === wallSide;
    const gMul = slidingWall ? WALL_SLIDE_GRAVITY_MUL : 1;
    actor.vy += GRAVITY * gMul * FIXED_DT;
    const fallCap = slidingWall ? WALL_SLIDE_MAX : MAX_FALL;
    if (actor.vy > fallCap) actor.vy = fallCap;
  }

  // --- Move + collide -------------------------------------------------------
  const dx = actor.vx * FIXED_DT;
  const dy = actor.vy * FIXED_DT;
  const bounds: Aabb = { x: actor.x, y: actor.y, w: PLAYER_W, h: PLAYER_H };

  const allSolids: { aabb: Aabb; frictionMul: number }[] = [];
  for (const s of solids) allSolids.push({ aabb: s, frictionMul: 1 });
  for (const p of pieces) {
    const def = PIECES[p.pieceId];
    if (!def.solid) continue;
    const mul = def.id === "ice" ? 200 / GROUND_FRICTION : 1;
    allSolids.push({ aabb: pieceAabb(p), frictionMul: mul });
  }
  // One-way platforms become "solid" only when the actor is falling onto them
  // from above. Holding down drops through: the platform is simply excluded
  // from the solid set until the stick is released, so the actor falls clear.
  const wantDrop = frame.moveY > 0.5 && !onLadder;
  if (!wantDrop) {
    for (const ow of oneWaySolids) {
      const movingDown = actor.vy >= 0;
      const above = actor.y + PLAYER_H <= ow.y + 2;
      if (movingDown && above) allSolids.push({ aabb: ow, frictionMul: 1 });
    }
  }

  const result = resolveMove(bounds, dx, dy, allSolids);
  actor.x = bounds.x;
  actor.y = bounds.y;

  // Contact state for next tick
  actor.groundFrictionMul = result.hitGround ? result.groundFrictionMul : 1;
  if (result.hitGround) {
    actor.vy = 0;
    actor.contact = "ground";
    actor.timeSinceGrounded = 0;
  } else {
    actor.timeSinceGrounded += dtMs;
    if (result.hitLeftWall) actor.contact = "leftWall";
    else if (result.hitRightWall) actor.contact = "rightWall";
    else actor.contact = "none";
  }
  if (result.hitLeftWall || result.hitRightWall) actor.vx = 0;
  if (result.hitCeiling && actor.vy < 0) actor.vy = 0;

  return result;
}

function resolveMove(
  bounds: Aabb,
  dx: number,
  dy: number,
  solids: { aabb: Aabb; frictionMul: number }[],
): MoveResult {
  let remainingDx = dx;
  let remainingDy = dy;
  let hitGround = false;
  let hitCeiling = false;
  let hitLeftWall = false;
  let hitRightWall = false;
  let groundFrictionMul = 1;

  // Up to 4 sub-resolutions (touch -> slide -> touch ...).
  for (let i = 0; i < 4; i++) {
    if (Math.abs(remainingDx) < 1e-6 && Math.abs(remainingDy) < 1e-6) break;

    let earliestT = 1;
    let earliestNx: -1 | 0 | 1 = 0;
    let earliestNy: -1 | 0 | 1 = 0;
    let earliestFriction = 1;

    for (const { aabb, frictionMul } of solids) {
      const hit = sweep(bounds, remainingDx, remainingDy, aabb);
      if (!hit) continue;
      if (hit.t < earliestT) {
        earliestT = hit.t;
        earliestNx = hit.nx;
        earliestNy = hit.ny;
        earliestFriction = frictionMul;
      }
    }

    bounds.x += remainingDx * earliestT;
    bounds.y += remainingDy * earliestT;

    if (earliestT >= 1) break;

    // Nudge away from the surface to avoid floating-point re-collision.
    bounds.x += earliestNx * SLOP;
    bounds.y += earliestNy * SLOP;

    if (earliestNy === -1) {
      hitGround = true;
      groundFrictionMul = earliestFriction;
    }
    if (earliestNy === 1) hitCeiling = true;
    if (earliestNx === -1) hitRightWall = true;
    if (earliestNx === 1) hitLeftWall = true;

    // Slide: zero out the component that just collided, continue with remainder.
    const leftover = 1 - earliestT;
    if (earliestNx !== 0) remainingDx = 0;
    else remainingDx *= leftover;
    if (earliestNy !== 0) remainingDy = 0;
    else remainingDy *= leftover;
  }

  return { hitGround, hitLeftWall, hitRightWall, hitCeiling, groundFrictionMul };
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}
