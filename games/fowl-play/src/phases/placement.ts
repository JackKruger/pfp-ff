import { GRID, PLACEMENT_MS } from "../constants.js";
import { contains, distToAabb, overlaps } from "../physics/aabb.js";
import { HAND_POOL, PIECES, makePlaced, pieceAabb } from "../pieces/registry.js";
import type {
  Arena,
  GameState,
  PieceId,
  PlacedPiece,
  PlacementCursor,
  PlayerFrame,
  Rot,
} from "../types.js";

const CURSOR_SPEED = 360; // px/sec while stick is held

/* -------------------------------------------------------------------------- */
/*  Hand draw                                                                 */
/* -------------------------------------------------------------------------- */

/** Deterministic hand draw using a simple LCG so tests can fix seeds. */
export function drawHand(seed: number, size: number): PieceId[] {
  let s = (seed | 0) || 1;
  const hand: PieceId[] = [];
  for (let i = 0; i < size; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    hand.push(HAND_POOL[s % HAND_POOL.length]);
  }
  return hand;
}

/* -------------------------------------------------------------------------- */
/*  Phase entry                                                               */
/* -------------------------------------------------------------------------- */

export function beginPlacement(state: GameState, baseSeed: number): void {
  state.phase = "placement";
  state.phaseTimer = PLACEMENT_MS;
  state.cursors = state.players
    .filter((p) => p.active)
    .map<PlacementCursor>((p, i) => ({
      slot: p.slot,
      x: state.arena.start.x + 16 + i * 24,
      y: state.arena.start.y - 24,
      rot: 0,
      handIdx: 0,
      hand: drawHand(baseSeed + state.round * 31 + p.slot, state.config.handSize),
      confirmed: false,
      lastPlacedUid: null,
    }));
}

/* -------------------------------------------------------------------------- */
/*  Tick                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Returns true when the placement phase should end (timer hit zero or all
 * active cursors have confirmed).
 */
export function tickPlacement(state: GameState, frames: PlayerFrame[], dtMs: number): boolean {
  state.phaseTimer = Math.max(0, state.phaseTimer - dtMs);

  for (const cursor of state.cursors) {
    const frame = frames.find((f) => f.slot === cursor.slot);
    if (!frame) continue;
    if (cursor.confirmed) {
      if (frame.cancelDown) {
        cancelOwnPlacement(state, cursor);
        cursor.confirmed = false;
      }
      continue;
    }

    // Move cursor.
    cursor.x += frame.moveX * CURSOR_SPEED * (dtMs / 1000);
    cursor.y += frame.moveY * CURSOR_SPEED * (dtMs / 1000);
    clampCursorToArena(cursor, state.arena);

    // Cycle piece selection.
    if (frame.nextDown) cursor.handIdx = (cursor.handIdx + 1) % cursor.hand.length;
    if (frame.prevDown)
      cursor.handIdx = (cursor.handIdx - 1 + cursor.hand.length) % cursor.hand.length;

    // Rotate (only rotatable pieces).
    const pieceDef = PIECES[cursor.hand[cursor.handIdx]];
    if (pieceDef.rotatable) {
      if (frame.rotCwDown) cursor.rot = rotateCw(cursor.rot);
      if (frame.rotCcwDown) cursor.rot = rotateCcw(cursor.rot);
    } else {
      cursor.rot = 0;
    }

    // Confirm.
    if (frame.confirmDown) {
      const placed = tryPlace(state, cursor);
      if (placed) {
        cursor.confirmed = true;
        cursor.lastPlacedUid = placed.uid;
        const player = state.players.find((p) => p.slot === cursor.slot);
        if (player) {
          player.score.trapsPlaced++;
          player.score.piecesByType[placed.pieceId] =
            (player.score.piecesByType[placed.pieceId] ?? 0) + 1;
        }
      }
    }

    // Cancel last own placement (rare — usually used post-confirm above).
    if (frame.cancelDown) {
      cancelOwnPlacement(state, cursor);
    }

    // Ready up early.
    if (frame.startDown && !cursor.confirmed) {
      // Treat as auto-skip: confirms nothing but marks ready.
      cursor.confirmed = true;
    }
  }

  const allDone = state.cursors.every((c) => c.confirmed);
  return allDone || state.phaseTimer <= 0;
}

/* -------------------------------------------------------------------------- */
/*  Placement validation + commit                                             */
/* -------------------------------------------------------------------------- */

export interface PlacementProbe {
  ok: boolean;
  reason?: "out_of_bounds" | "overlap" | "no_go";
}

/** Test whether a piece could be placed at the cursor's snapped location. */
export function probePlacement(
  state: GameState,
  cursor: PlacementCursor,
): PlacementProbe {
  const probe = ghostFor(cursor);
  const aabb = pieceAabb(probe);

  if (!contains(state.arena.bounds, aabb)) return { ok: false, reason: "out_of_bounds" };

  for (const z of state.arena.noGoZones) {
    if (distToAabb(z.x, z.y, aabb) < z.r) return { ok: false, reason: "no_go" };
  }
  for (const s of state.arena.solids) {
    if (overlaps(aabb, s)) return { ok: false, reason: "overlap" };
  }
  for (const p of state.pieces) {
    if (overlaps(aabb, pieceAabb(p))) return { ok: false, reason: "overlap" };
  }
  return { ok: true };
}

function tryPlace(state: GameState, cursor: PlacementCursor): PlacedPiece | null {
  const probe = probePlacement(state, cursor);
  if (!probe.ok) return null;
  const ghost = ghostFor(cursor);
  const placed = makePlaced(
    state.nextUid++,
    ghost.pieceId,
    ghost.x,
    ghost.y,
    ghost.rot,
    cursor.slot,
  );
  state.pieces.push(placed);
  return placed;
}

function cancelOwnPlacement(state: GameState, cursor: PlacementCursor): void {
  if (cursor.lastPlacedUid == null) return;
  const idx = state.pieces.findIndex((p) => p.uid === cursor.lastPlacedUid);
  if (idx >= 0) state.pieces.splice(idx, 1);
  cursor.lastPlacedUid = null;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

export function ghostFor(cursor: PlacementCursor): PlacedPiece {
  const pieceId = cursor.hand[cursor.handIdx];
  const def = PIECES[pieceId];
  const swap = cursor.rot === 1 || cursor.rot === 3;
  const w = swap ? def.h : def.w;
  const h = swap ? def.w : def.h;
  const x = snap(cursor.x - w / 2);
  const y = snap(cursor.y - h / 2);
  return { uid: -1, pieceId, x, y, rot: cursor.rot, placedBy: cursor.slot };
}

function snap(n: number): number {
  return Math.round(n / GRID) * GRID;
}

function clampCursorToArena(cursor: PlacementCursor, arena: Arena): void {
  cursor.x = clamp(cursor.x, arena.bounds.x, arena.bounds.x + arena.bounds.w);
  cursor.y = clamp(cursor.y, arena.bounds.y, arena.bounds.y + arena.bounds.h);
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function rotateCw(r: Rot): Rot {
  return ((r + 1) & 3) as Rot;
}
function rotateCcw(r: Rot): Rot {
  return ((r + 3) & 3) as Rot;
}

export const _internal = { snap, rotateCw, rotateCcw, ghostFor };

// Re-export for tests / debug surfaces.
export function pieceForCursor(cursor: PlacementCursor): PieceId {
  return cursor.hand[cursor.handIdx];
}
