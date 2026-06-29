import type { Aabb, PieceDef, PieceId, PlacedPiece, Rot } from "../types.js";

/**
 * The committed v1 piece library. Behaviour beyond the static shape (movers,
 * fan force, conveyor push, crusher cycle, etc.) is implemented in the race
 * phase; this registry is the source of truth for size + flags.
 */
export const PIECES: Record<PieceId, PieceDef> = {
  // Platforms (5)
  plank: {
    id: "plank",
    category: "platform",
    w: 96,
    h: 16,
    name: "Wooden Plank",
    blurb: "Long, flat. The bread and butter.",
    inHand: true,
    solid: true,
    lethal: false,
    rotatable: true,
  },
  block: {
    id: "block",
    category: "platform",
    w: 32,
    h: 32,
    name: "Small Block",
    blurb: "Tiny solid block. Easy to wedge anywhere.",
    inHand: true,
    solid: true,
    lethal: false,
    rotatable: false,
  },
  ice: {
    id: "ice",
    category: "platform",
    w: 64,
    h: 32,
    name: "Ice Block",
    blurb: "Slippery. Hard to stop on.",
    inHand: true,
    solid: true,
    lethal: false,
    rotatable: true,
  },
  bouncy: {
    id: "bouncy",
    category: "platform",
    w: 64,
    h: 16,
    name: "Bouncy Platform",
    blurb: "Bounces you up a notch on contact.",
    inHand: true,
    solid: true,
    lethal: false,
    rotatable: true,
  },
  conveyor: {
    id: "conveyor",
    category: "platform",
    w: 96,
    h: 16,
    name: "Conveyor",
    blurb: "Pushes you along when you stand on it.",
    inHand: true,
    solid: true,
    lethal: false,
    rotatable: true,
  },

  // Hazards (6)
  spike: {
    id: "spike",
    category: "hazard",
    w: 64,
    h: 16,
    name: "Spike Strip",
    blurb: "Kills from above.",
    inHand: true,
    solid: false,
    lethal: true,
    rotatable: true,
  },
  saw: {
    id: "saw",
    category: "hazard",
    w: 32,
    h: 32,
    name: "Saw Blade",
    blurb: "Spinning. Kills from any direction.",
    inHand: true,
    solid: false,
    lethal: true,
    rotatable: false,
  },
  crusher: {
    id: "crusher",
    category: "hazard",
    w: 48,
    h: 48,
    name: "Crusher",
    blurb: "Drops every two seconds. Kills anything under it.",
    inHand: true,
    solid: false,
    lethal: true,
    rotatable: false,
  },
  coals: {
    id: "coals",
    category: "hazard",
    w: 48,
    h: 16,
    name: "Hot Coals",
    blurb: "Kills on contact, any side.",
    inHand: true,
    solid: false,
    lethal: true,
    rotatable: true,
  },
  fan: {
    id: "fan",
    category: "hazard",
    w: 48,
    h: 48,
    name: "Fan",
    blurb: "Blows players away. Not lethal.",
    inHand: true,
    solid: false,
    lethal: false,
    rotatable: true,
  },
  puck: {
    id: "puck",
    category: "hazard",
    w: 32,
    h: 32,
    name: "Hockey Puck",
    blurb: "Launches at race start. Bounces around. Lethal.",
    inHand: true,
    solid: false,
    lethal: true,
    rotatable: true,
  },

  // Movers (3)
  mace: {
    id: "mace",
    category: "mover",
    w: 48,
    h: 16,
    name: "Swinging Mace",
    blurb: "Swings on a chain. Lethal.",
    inHand: true,
    solid: false,
    lethal: true,
    rotatable: false,
  },
  pendulum: {
    id: "pendulum",
    category: "mover",
    w: 96,
    h: 16,
    name: "Pendulum Platform",
    blurb: "Swings back and forth. Ride-able.",
    inHand: true,
    solid: true,
    lethal: false,
    rotatable: false,
  },
  log: {
    id: "log",
    category: "mover",
    w: 16,
    h: 96,
    name: "Falling Log",
    blurb: "Drops three seconds into the race. Lethal.",
    inHand: true,
    solid: false,
    lethal: true,
    rotatable: true,
  },

  // Helpers (2)
  trampoline: {
    id: "trampoline",
    category: "helper",
    w: 48,
    h: 16,
    name: "Trampoline",
    blurb: "Launches you sky-high.",
    inHand: true,
    solid: true,
    lethal: false,
    rotatable: true,
  },
  ladder: {
    id: "ladder",
    category: "helper",
    w: 16,
    h: 96,
    name: "Ladder",
    blurb: "Climb up or down.",
    inHand: true,
    solid: false,
    lethal: false,
    rotatable: false,
  },

  // Scorers — arena-placed only
  coin: {
    id: "coin",
    category: "scorer",
    w: 24,
    h: 24,
    name: "Coin",
    blurb: "Worth one point.",
    inHand: false,
    solid: false,
    lethal: false,
    rotatable: false,
  },
  diamond: {
    id: "diamond",
    category: "scorer",
    w: 32,
    h: 32,
    name: "Diamond",
    blurb: "Worth three points.",
    inHand: false,
    solid: false,
    lethal: false,
    rotatable: false,
  },
};

/** All player-handable piece ids in spawn-pool order. */
export const HAND_POOL: PieceId[] = (Object.values(PIECES) as PieceDef[])
  .filter((p) => p.inHand)
  .map((p) => p.id);

/** Return the AABB of a placed piece after rotation, in world coordinates. */
export function pieceAabb(piece: PlacedPiece): Aabb {
  const def = PIECES[piece.pieceId];
  // 90° rotations swap w/h. (Defs already at rot=0.)
  const swap = piece.rot === 1 || piece.rot === 3;
  return {
    x: piece.x,
    y: piece.y,
    w: swap ? def.h : def.w,
    h: swap ? def.w : def.h,
  };
}

/** Build a fresh PlacedPiece. */
export function makePlaced(
  uid: number,
  pieceId: PieceId,
  x: number,
  y: number,
  rot: Rot,
  placedBy: number,
): PlacedPiece {
  return { uid, pieceId, x, y, rot, placedBy };
}
