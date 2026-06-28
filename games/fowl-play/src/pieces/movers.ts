import { overlaps } from "../physics/aabb.js";
import { PIECES, pieceAabb } from "./registry.js";
import type {
  Aabb,
  GameState,
  PlacedPiece,
  RaceActor,
  RuntimePiece,
} from "../types.js";

/**
 * Per-piece dynamics for the v1 mover set.
 *
 * Each function tickXxx(piece, runtime, dtMs, ctx) advances the piece for one
 * frame. Mutations land in piece.x/y (so collision uses the current effective
 * AABB) and in runtime fields (timers, velocities, sub-state).
 *
 * Pieces that don't need runtime simply aren't registered here.
 */

const CRUSHER_REST_MS = 1500;
const CRUSHER_DROP_MS = 250; // accelerate down
const CRUSHER_HOLD_MS = 200; // pause at floor
const CRUSHER_RETURN_MS = 600;
const CRUSHER_DROP_DIST = 96;

const MACE_PERIOD_MS = 1500;
const MACE_AMPLITUDE = Math.PI / 3;
const MACE_CHAIN = 96;

const PENDULUM_PERIOD_MS = 2000;
const PENDULUM_AMPLITUDE = Math.PI / 4;
const PENDULUM_CHAIN = 96;

const LOG_DELAY_MS = 3000;
const LOG_GRAVITY = 1500;
const LOG_MAX_FALL = 1200;

const FAN_RANGE = 200;
const FAN_ACCEL = 600; // px/s² toward player

const PUCK_LAUNCH = 420;
const PUCK_FRICTION = 0.997; // velocity multiplier per ms (kept above 0.99 so it survives long enough to threaten)
const PUCK_LIFETIME_MS = 60_000;

/* -------------------------------------------------------------------------- */
/*  Init                                                                      */
/* -------------------------------------------------------------------------- */

/** Build initial runtime data for any piece that has motion. */
export function initRuntimeFor(piece: PlacedPiece): RuntimePiece | null {
  switch (piece.pieceId) {
    case "crusher":
      return {
        uid: piece.uid,
        origX: piece.x,
        origY: piece.y,
        t: 0,
        state: "rest",
        vx: 0,
        vy: 0,
        active: true,
      };
    case "mace":
    case "pendulum":
      return {
        uid: piece.uid,
        origX: piece.x,
        origY: piece.y,
        t: 0,
        state: "swing",
        vx: 0,
        vy: 0,
        active: true,
      };
    case "log":
      return {
        uid: piece.uid,
        origX: piece.x,
        origY: piece.y,
        t: 0,
        state: "waiting",
        vx: 0,
        vy: 0,
        active: true,
      };
    case "fan":
      return {
        uid: piece.uid,
        origX: piece.x,
        origY: piece.y,
        t: 0,
        state: "on",
        vx: 0,
        vy: 0,
        active: true,
      };
    case "puck": {
      const dir = directionOf(piece.rot);
      return {
        uid: piece.uid,
        origX: piece.x,
        origY: piece.y,
        t: 0,
        state: "armed",
        vx: dir.x * PUCK_LAUNCH,
        vy: dir.y * PUCK_LAUNCH,
        active: true,
      };
    }
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Tick                                                                      */
/* -------------------------------------------------------------------------- */

/** Advance every runtime piece by dtMs and apply effects to the live actors. */
export function tickMovers(state: GameState, dtMs: number): void {
  for (const piece of state.pieces) {
    const rt = state.runtime.get(piece.uid);
    if (!rt || !rt.active) continue;
    rt.t += dtMs;
    switch (piece.pieceId) {
      case "crusher":
        tickCrusher(piece, rt, dtMs, state);
        break;
      case "mace":
      case "pendulum":
        tickSwing(piece, rt, dtMs);
        break;
      case "log":
        tickLog(piece, rt, dtMs, state);
        break;
      case "fan":
        tickFan(piece, rt, dtMs, state);
        break;
      case "puck":
        tickPuck(piece, rt, dtMs, state);
        break;
    }
  }
}

function tickCrusher(
  piece: PlacedPiece,
  rt: RuntimePiece,
  _dtMs: number,
  state: GameState,
): void {
  // State machine: rest → drop → hold → return → rest.
  const cycleLen = CRUSHER_REST_MS + CRUSHER_DROP_MS + CRUSHER_HOLD_MS + CRUSHER_RETURN_MS;
  const cycle = rt.t % cycleLen;
  const prev = rt.state;

  if (cycle < CRUSHER_REST_MS) {
    rt.state = "rest";
    piece.y = rt.origY;
  } else if (cycle < CRUSHER_REST_MS + CRUSHER_DROP_MS) {
    rt.state = "dropping";
    const phase = (cycle - CRUSHER_REST_MS) / CRUSHER_DROP_MS;
    piece.y = rt.origY + phase * CRUSHER_DROP_DIST;
  } else if (cycle < CRUSHER_REST_MS + CRUSHER_DROP_MS + CRUSHER_HOLD_MS) {
    rt.state = "down";
    piece.y = rt.origY + CRUSHER_DROP_DIST;
  } else {
    rt.state = "returning";
    const phase =
      (cycle - CRUSHER_REST_MS - CRUSHER_DROP_MS - CRUSHER_HOLD_MS) / CRUSHER_RETURN_MS;
    piece.y = rt.origY + CRUSHER_DROP_DIST * (1 - phase);
  }

  // Impact dust on the first frame of the "down" state.
  if (prev === "dropping" && rt.state === "down") emitCrusherDust(piece, state);
}

function emitCrusherDust(piece: PlacedPiece, state: GameState): void {
  const def = PIECES[piece.pieceId];
  const cx = piece.x + def.w / 2;
  const baseY = piece.y + def.h;
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI + (Math.PI / 7) * i;
    state.particles.push({
      x: cx,
      y: baseY,
      vx: Math.cos(angle) * 240,
      vy: Math.sin(angle) * 60 - 120,
      color: "#cbd5e1",
      life: 380,
      maxLife: 380,
    });
  }
}

function tickSwing(piece: PlacedPiece, rt: RuntimePiece, _dtMs: number): void {
  const amplitude = piece.pieceId === "mace" ? MACE_AMPLITUDE : PENDULUM_AMPLITUDE;
  const period = piece.pieceId === "mace" ? MACE_PERIOD_MS : PENDULUM_PERIOD_MS;
  const chain = piece.pieceId === "mace" ? MACE_CHAIN : PENDULUM_CHAIN;

  const def = PIECES[piece.pieceId];
  const halfW = def.w / 2;
  const halfH = def.h / 2;
  // Pivot is anchored above the initial centerline so the swing arc points down.
  const pivotX = rt.origX + halfW;
  const pivotY = rt.origY - chain + halfH;

  const angle = amplitude * Math.sin((2 * Math.PI * rt.t) / period);
  piece.x = pivotX + chain * Math.sin(angle) - halfW;
  piece.y = pivotY + chain * Math.cos(angle) - halfH;
}

function tickLog(piece: PlacedPiece, rt: RuntimePiece, dtMs: number, state: GameState): void {
  if (rt.state === "waiting") {
    if (rt.t >= LOG_DELAY_MS) rt.state = "falling";
    return;
  }
  if (rt.state === "falling") {
    rt.vy = Math.min(LOG_MAX_FALL, rt.vy + LOG_GRAVITY * (dtMs / 1000));
    piece.y += rt.vy * (dtMs / 1000);

    // If we punch through the kill-line, the log is consumed.
    if (piece.y > state.arena.killLineY) {
      rt.active = false;
      return;
    }
    // Land on the first solid we overlap; kill itself there.
    const aabb = pieceAabb(piece);
    for (const s of state.arena.solids) {
      if (overlaps(aabb, s)) {
        rt.state = "landed";
        rt.active = false;
        // Snap to top of the solid.
        piece.y = s.y - aabb.h;
        return;
      }
    }
  }
}

function tickFan(piece: PlacedPiece, _rt: RuntimePiece, dtMs: number, state: GameState): void {
  const dir = directionOf(piece.rot);
  const center = {
    x: piece.x + PIECES.fan.w / 2,
    y: piece.y + PIECES.fan.h / 2,
  };
  for (const actor of state.actors) {
    if (!actor.alive || actor.finished) continue;
    const ax = actor.x + 12;
    const ay = actor.y + 12;
    // Project actor offset onto fan direction.
    const dx = ax - center.x;
    const dy = ay - center.y;
    const along = dx * dir.x + dy * dir.y;
    if (along < 0 || along > FAN_RANGE) continue;
    // Perpendicular distance to fan axis.
    const perp = Math.abs(dx * dir.y - dy * dir.x);
    if (perp > 32) continue;
    actor.vx += dir.x * FAN_ACCEL * (dtMs / 1000);
    actor.vy += dir.y * FAN_ACCEL * (dtMs / 1000);
  }
}

function tickPuck(piece: PlacedPiece, rt: RuntimePiece, dtMs: number, state: GameState): void {
  if (rt.t > PUCK_LIFETIME_MS) {
    rt.active = false;
    return;
  }
  // Decay velocity ever so slightly.
  const decay = Math.pow(PUCK_FRICTION, dtMs);
  rt.vx *= decay;
  rt.vy *= decay;

  // Move and bounce off solids by axis-separated step.
  piece.x += rt.vx * (dtMs / 1000);
  const aabb = pieceAabb(piece);
  for (const s of solidAabbs(state)) {
    if (overlaps(aabb, s)) {
      // Bounce out along x.
      if (rt.vx > 0) piece.x = s.x - aabb.w - 0.1;
      else piece.x = s.x + s.w + 0.1;
      rt.vx = -rt.vx;
      break;
    }
  }
  piece.y += rt.vy * (dtMs / 1000);
  const aabbY = pieceAabb(piece);
  for (const s of solidAabbs(state)) {
    if (overlaps(aabbY, s)) {
      if (rt.vy > 0) piece.y = s.y - aabbY.h - 0.1;
      else piece.y = s.y + s.h + 0.1;
      rt.vy = -rt.vy;
      break;
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Convert a rotation index into a unit direction. 0=right, 1=down, 2=left, 3=up. */
function directionOf(rot: number): { x: number; y: number } {
  switch (rot & 3) {
    case 0:
      return { x: 1, y: 0 };
    case 1:
      return { x: 0, y: 1 };
    case 2:
      return { x: -1, y: 0 };
    default:
      return { x: 0, y: -1 };
  }
}

function solidAabbs(state: GameState): Aabb[] {
  const out: Aabb[] = [...state.arena.solids];
  for (const p of state.pieces) {
    if (PIECES[p.pieceId].solid) out.push(pieceAabb(p));
  }
  return out;
}

/**
 * Returns true if this piece is currently lethal to actors. Most lethal
 * pieces are always lethal; crusher is only lethal while dropping or in the
 * brief floor-hold; log only while falling; puck only while active.
 */
export function pieceIsLethal(piece: PlacedPiece, rt: RuntimePiece | undefined): boolean {
  const def = PIECES[piece.pieceId];
  if (!def.lethal) return false;
  if (!rt) return true; // always-lethal static hazards (spike, saw, coals)

  switch (piece.pieceId) {
    case "crusher":
      return rt.state === "dropping" || rt.state === "down";
    case "log":
      return rt.state === "falling";
    case "puck":
      return rt.active;
    default:
      return rt.active;
  }
}

/** Re-export for testing. */
export const _crusher = {
  REST: CRUSHER_REST_MS,
  DROP: CRUSHER_DROP_MS,
  HOLD: CRUSHER_HOLD_MS,
  RETURN: CRUSHER_RETURN_MS,
  DIST: CRUSHER_DROP_DIST,
};
export const _mace = { PERIOD: MACE_PERIOD_MS, AMPLITUDE: MACE_AMPLITUDE, CHAIN: MACE_CHAIN };
export const _log = { DELAY: LOG_DELAY_MS };

// Silence unused-actor warning when fan-tick handles every actor.
export type _ActorAlias = RaceActor;
