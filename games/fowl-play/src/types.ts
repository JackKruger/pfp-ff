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

/**
 * Environment hazard a specific arena owns — they aren't player-placeable and
 * aren't part of the piece registry. Currently the only kind is the windmill's
 * rotating blade.
 */
export type ArenaDynamic = {
  kind: "blade";
  /** Pivot point in world coordinates. */
  pivotX: number;
  pivotY: number;
  /** Length of the rotating arm. */
  length: number;
  /** Width of the lethal segment perpendicular to the arm. */
  thickness: number;
  /** Rotation period in ms (positive = clockwise). */
  periodMs: number;
};

export interface Arena {
  id: string;
  name: string;
  bounds: Aabb;
  killLineY: number;
  start: Vec2;
  goal: Aabb;
  /** Static, non-removable arena solids. */
  solids: Aabb[];
  /** Drop-through platforms: collide as solid only when the actor is falling
   *  and not already overlapping. Players can jump up through them. */
  oneWaySolids?: Aabb[];
  scorers: ArenaScorer[];
  noGoZones: { x: number; y: number; r: number }[];
  /** Environment hazards owned by the arena (e.g. the Windmill's blade). */
  dynamics?: ArenaDynamic[];
  /** Optional background palette hint for the renderer. */
  bg?: { top: string; bottom: string };
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

/** Match configuration; surfaces in launch.settings. */
export interface GameConfig {
  winScore: number;
  handSize: number;
  arenaPool: "all" | "random";
}

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
  /** Recent positions for the motion trail (optional cosmetic). */
  trail?: Vec2[];
  /** Slot of the player whose placed piece killed them, or -1. */
  killedBy: number;
  /** What killed this actor, or null if still alive. */
  killedByCause: DeathCause | null;
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

/* -------------------------------------------------------------------------- */
/*  Visual feedback                                                           */
/* -------------------------------------------------------------------------- */

/** A short text that floats up and fades — used for "+1", "TRAP KILL", etc. */
export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

/** A point-particle used for death bursts and similar VFX. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
}

/** Short screen-space message — "P1 was minced by SAW", etc. */
export interface Toast {
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

/** Expanding ring at the goal when a player finishes. */
export interface GoalPulse {
  color: string;
  life: number;
  maxLife: number;
}

/** Cause of death for the toast layer and stats. */
export type DeathCause = PieceId | "fall" | "crush" | "blade";

/** Sound events emitted by the FSM each tick; drained by the audio layer. */
export type SoundEvent =
  | "jump"
  | "coin"
  | "diamond"
  | "death"
  | "kill"
  | "finish"
  | "loneSurvivor"
  | "countdownTick"
  | "go"
  | "win";

/* -------------------------------------------------------------------------- */
/*  Mover runtime                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Per-piece dynamic state during the race phase. Movers (crusher, mace,
 * pendulum, log, puck, fan) need timers + velocities the static PlacedPiece
 * doesn't carry. Stored in a parallel Map<uid, RuntimePiece> on GameState so
 * the placed pieces stay describing the placement, and runtime is wiped at
 * the start of each race.
 */
export interface RuntimePiece {
  uid: number;
  /** Original placement position; mutating piece.x/y is fine but we keep this for swing pivots etc. */
  origX: number;
  origY: number;
  /** Animation timer (ms). */
  t: number;
  /** Sub-state, free-form per piece type. */
  state: string;
  /** Linear velocity for puck, log, etc. */
  vx: number;
  vy: number;
  /** One-shot pieces (log after landing, puck after timeout) can self-disable. */
  active: boolean;
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
  /** Mover runtime state, keyed by piece uid; populated at race start. */
  runtime: Map<number, RuntimePiece>;
  /** Score popups and other text VFX, world-space, decay each tick. */
  floats: FloatingText[];
  /** Death particles + small VFX bursts, world-space. */
  particles: Particle[];
  /** Screen-space toasts (announcements that don't belong in a banner). */
  toasts: Toast[];
  /** Active goal-pulse rings, awarded per finisher. */
  goalPulses: GoalPulse[];
  /** Sound events emitted this tick; drained by the audio layer in main.ts. */
  soundEvents: SoundEvent[];
  /** True while the shell has paused the game. */
  paused: boolean;
  /** Match-level configuration, optionally overridden by launch.settings. */
  config: GameConfig;
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
