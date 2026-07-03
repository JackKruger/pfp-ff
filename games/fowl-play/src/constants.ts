/**
 * All committed tuning numbers from docs/FOWL_PLAY_DESIGN.md live here so the
 * design doc and the code stay in lockstep. Logical canvas is 1280x720; arena
 * bounds (per arena) can be larger and the camera pans.
 */

export const LOGICAL_W = 1280;
export const LOGICAL_H = 720;

export const FIXED_DT = 1 / 60;
export const FIXED_MS = 1000 / 60;
export const MAX_SUBSTEPS = 4;
export const GRID = 16;

// Character / movement
export const PLAYER_W = 24;
export const PLAYER_H = 24;
export const GRAVITY = 1800;
export const MAX_FALL = 900;
export const WALK_MAX = 280;
export const GROUND_ACCEL = 1600;
export const GROUND_FRICTION = 1400;
export const AIR_ACCEL = 1120;
export const JUMP_VY = 720;
export const JUMP_CUT_VY = 280;
export const JUMP_CUT_MS = 180;
export const COYOTE_MS = 100;
export const JUMP_BUFFER_MS = 100;
export const WALL_SLIDE_GRAVITY_MUL = 0.5;
export const WALL_SLIDE_MAX = 240;
export const WALL_JUMP_VX = 600;
export const WALL_JUMP_VY = 700;

// Phase timing (ms)
export const PLACEMENT_MS = 30_000;
export const RACE_COUNTDOWN_MS = 3_000;
export const RACE_MAX_MS = 60_000;
export const SCORE_MS = 5_000;
export const LOOK_AROUND_MS = 5_000; // first placement of each match
export const FINAL_HOLD_MS = 12_000; // long enough to read the awards; A skips

// Match
export const WIN_SCORE = 9;
export const HAND_SIZE = 5;
export const NO_GO_RADIUS = 64;

// Scoring
export const SCORE_FINISH = 1;
export const SCORE_COIN = 1;
export const SCORE_DIAMOND = 3;
export const SCORE_LONE_SURVIVOR = 2;
export const SCORE_TRAP_KILL = 1;

// Camera
export const CAM_PADDING = 96;
export const CAM_ZOOM_MIN = 0.5;
export const CAM_ZOOM_MAX = 1.0;
export const CAM_LERP = 0.1;

// Visuals — feedback layer
export const FLOAT_LIFE_MS = 900;
export const FLOAT_RISE_SPEED = 60; // px/s upward
export const PARTICLE_LIFE_MS = 600;
export const PARTICLE_BURST_COUNT = 8;
export const PARTICLE_SPEED = 180;
export const PARTICLE_GRAVITY = 800;
export const URGENCY_THRESHOLD_MS = 5000;
export const SPAWN_STAGGER_PX = 28; // horizontal spacing between simultaneous spawns
export const TOAST_LIFE_MS = 2400;
export const GOAL_PULSE_LIFE_MS = 700;

// Player palette (matches shell PLAYER_COLORS but games may be launched
// stand-alone with arbitrary colors; we still keep these as the gameplay
// fallback).
export const FALLBACK_PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"] as const;
