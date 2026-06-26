import type { LaunchContext } from "@pfp/sdk";

/* -------------------------------------------------------------------------- */
/*  Geometry                                                                  */
/* -------------------------------------------------------------------------- */

export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned bounding box; (x, y) is top-left. */
export interface Aabb {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                    */
/* -------------------------------------------------------------------------- */

export type PieceCategory = "platform" | "hazard" | "mover" | "helper" | "scorer";

export type PieceId =
  | "plank"
  | "block"
  | "ice"
  | "bouncy"
  | "conveyor"
  | "spike"
  | "saw"
  | "crusher"
  | "coals"
  | "fan"
  | "puck"
  | "mace"
  | "pendulum"
  | "log"
  | "trampoline"
  | "ladder"
  // arena-placed scorers; not in player hand
  | "coin"
  | "diamond";

/** Rotation in 90° increments. 0=identity, 1=CW90, 2=180, 3=CW270. */
export type Rot = 0 | 1 | 2 | 3;

export interface PieceDef {
  id: PieceId;
  category: PieceCategory;
  /** Native (unrotated) hitbox size. */
  w: number;
  h: number;
  /** Friendly name shown in HUD tooltips. */
  name: string;
  /** One-line description shown in HUD tooltips. */
  blurb: string;
  /** Whether the piece appears in the random player hand. */
  inHand: boolean;
  /** Whether the piece is solid (you can stand on it). */
  solid: boolean;
  /** Whether contact is lethal to a player. */
  lethal: boolean;
  /** Whether the piece can be rotated by the player. */
  rotatable: boolean;
}

/** A piece placed in the world. */
export interface PlacedPiece {
  uid: number;
  pieceId: PieceId;
  /** Top-left of the AABB after rotation, snapped to grid. */
  x: number;
  y: number;
  rot: Rot;
  /** Slot of the player who placed it, or -1 if arena-placed. */
  placedBy: number;
}

/* -------------------------------------------------------------------------- */
/*  Arenas                                                                    */
/* -------------------------------------------------------------------------- */

export interface ArenaScorer {
  pieceId: "coin" | "diamond";
  x: number;
  y: number;
}

export interface Arena {
  id: string;
  name: string;
  bounds: Aabb;
  killLineY: number;
  start: Vec2;
  goal: Aabb;
  /** Static, non-removable arena solids. */
  solids: Aabb[];
  scorers: ArenaScorer[];
  noGoZones: { x: number; y: number; r: number }[];
}

/* -------------------------------------------------------------------------- */
/*  Players                                                                   */
/* -------------------------------------------------------------------------- */

export interface PlayerScore {
  finalScore: number;
  roundsWon: number;
  finishes: number;
  deaths: number;
  coinsCollected: number;
  diamondsCollected: number;
  killsCaused: number;
  loneSurvivor: number;
  trapsPlaced: number;
  selfKills: number;
  piecesByType: Partial<Record<PieceId, number>>;
}

export function makeEmptyPlayerScore(): PlayerScore {
  return {
    finalScore: 0,
    roundsWon: 0,
    finishes: 0,
    deaths: 0,
    coinsCollected: 0,
    diamondsCollected: 0,
    killsCaused: 0,
    loneSurvivor: 0,
    trapsPlaced: 0,
    selfKills: 0,
    piecesByType: {},
  };
}

export interface Player {
  slot: number;
  profileId: string | null;
  displayName: string;
  color: string;
  gamepadIndex: number;
  /** Cumulative match score and stats. */
  score: PlayerScore;
  /** Whether the player slot is still connected/active. */
  active: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Round state                                                               */
/* -------------------------------------------------------------------------- */

export type Phase = "intro" | "placement" | "race" | "score" | "final";

/** Per-player live racing state (only meaningful during race phase). */
export interface RaceActor {
  slot: number;
  /** Top-left of AABB. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  finished: boolean;
  /** epoch ms when the player crossed the goal, or 0. */
  finishedAt: number;
  /** epoch ms when the player died, or 0. */
  diedAt: number;
  /** Where they died, for the skull glyph. */
  deathPos: Vec2 | null;
  /** Slot of the player whose placed piece killed them, or -1. */
  killedBy: number;
  /** Last surface they were on: ground/leftWall/rightWall/none. Drives wall-jump. */
  contact: "ground" | "leftWall" | "rightWall" | "none";
  /** ms since last grounded for coyote-time. */
  timeSinceGrounded: number;
  /** ms since A pressed for jump buffer. */
  jumpBuffer: number;
  /** True while jump key is held (for variable-cut). */
  jumpHeld: boolean;
  /** ms since the jump began, for variable cut window. */
  jumpAge: number;
  /** Coins collected this round. */
  roundCoins: number;
  diamondsThisRound: number;
}

export interface PlacementCursor {
  slot: number;
  /** Cursor world position (grid-snapped at confirm). */
  x: number;
  y: number;
  rot: Rot;
  /** Index into the player's hand. */
  handIdx: number;
  /** PieceIds in the player's hand for this round (random draw). */
  hand: PieceId[];
  /** True if the player has confirmed a placement this round. */
  confirmed: boolean;
  /** Last own piece they placed; clears on cancel. */
  lastPlacedUid: number | null;
}

export type RoundOutcome = "all_finished" | "all_dead" | "timeout";

export interface RoundLog {
  arenaId: string;
  outcome: RoundOutcome;
  /** Per-slot points delta for this round. */
  delta: Map<number, number>;
}

export interface GameState {
  phase: Phase;
  /** ms remaining in the current phase. */
  phaseTimer: number;
  /** Current round index (1-based once placement begins). */
  round: number;
  arena: Arena;
  players: Player[];
  /** Placed pieces in the current arena, including arena-placed scorers. */
  pieces: PlacedPiece[];
  /** Live actors for the race phase (one per active player). */
  actors: RaceActor[];
  /** Placement cursors (one per active player, only during placement). */
  cursors: PlacementCursor[];
  /** Most-recent round log for the score phase to display. */
  lastRound: RoundLog | null;
  /** All round logs since match start. */
  history: RoundLog[];
  /** Monotonic uid for pieces. */
  nextUid: number;
  /** epoch ms when the match started. */
  startedAt: number;
  /** Set once gameOver is emitted, to prevent double-emit. */
  ended: boolean;
  /** Set true on first placement of the match to show the look-around hint. */
  showLookAroundHint: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Input                                                                     */
/* -------------------------------------------------------------------------- */

/** Normalized per-player input frame the FSM consumes each tick. */
export interface PlayerFrame {
  slot: number;
  /** L-stick X, deadzoned. -1..1. */
  moveX: number;
  /** L-stick Y, deadzoned. -1..1. */
  moveY: number;
  /** Edge-triggered button presses (this frame only). */
  jumpDown: boolean;
  jumpUp: boolean;
  confirmDown: boolean; // A
  cancelDown: boolean; // B
  nextDown: boolean; // X
  prevDown: boolean; // Y
  rotCwDown: boolean; // RB
  rotCcwDown: boolean; // LB
  startDown: boolean;
  /** True while jump is held — used for variable-cut. */
  jumpHeld: boolean;
}

export function makeFrame(slot: number): PlayerFrame {
  return {
    slot,
    moveX: 0,
    moveY: 0,
    jumpDown: false,
    jumpUp: false,
    confirmDown: false,
    cancelDown: false,
    nextDown: false,
    prevDown: false,
    rotCwDown: false,
    rotCcwDown: false,
    startDown: false,
    jumpHeld: false,
  };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Build empty Player[] from a LaunchContext. */
export function makePlayers(launch: LaunchContext): Player[] {
  return launch.players.map((p) => ({
    slot: p.slot,
    profileId: p.profileId,
    displayName: p.displayName,
    color: p.color,
    gamepadIndex: p.gamepadIndex,
    score: makeEmptyPlayerScore(),
    active: true,
  }));
}
