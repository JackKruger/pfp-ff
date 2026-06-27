import {
  FIXED_MS,
  FLOAT_LIFE_MS,
  FLOAT_RISE_SPEED,
  MAX_SUBSTEPS,
  PARTICLE_BURST_COUNT,
  PARTICLE_GRAVITY,
  PARTICLE_LIFE_MS,
  PARTICLE_SPEED,
  PLAYER_H,
  PLAYER_W,
  RACE_COUNTDOWN_MS,
  RACE_MAX_MS,
  SCORE_COIN,
  SCORE_DIAMOND,
  SCORE_FINISH,
  SCORE_LONE_SURVIVOR,
  SCORE_TRAP_KILL,
  SPAWN_STAGGER_PX,
} from "../constants.js";
import { overlaps } from "../physics/aabb.js";
import { stepActor } from "../physics/player.js";
import { initRuntimeFor, pieceIsLethal, tickMovers } from "../pieces/movers.js";
import { pieceAabb, PIECES } from "../pieces/registry.js";
import type {
  Aabb,
  GameState,
  PlacedPiece,
  PlayerFrame,
  RaceActor,
  RoundLog,
  RoundOutcome,
} from "../types.js";

/* -------------------------------------------------------------------------- */
/*  Phase entry                                                               */
/* -------------------------------------------------------------------------- */

export function beginRace(state: GameState): void {
  state.phase = "race";
  state.phaseTimer = RACE_COUNTDOWN_MS + RACE_MAX_MS;
  state.runtime = new Map();
  state.floats = [];
  state.particles = [];
  for (const piece of state.pieces) {
    const rt = initRuntimeFor(piece);
    if (rt) state.runtime.set(piece.uid, rt);
  }
  const activePlayers = state.players.filter((p) => p.active);
  // Stagger spawn positions so players don't perfectly overlap. Centered
  // around state.arena.start.x so the camera framing is balanced.
  const span = (activePlayers.length - 1) * SPAWN_STAGGER_PX;
  state.actors = activePlayers.map<RaceActor>((p, i) => ({
    slot: p.slot,
    x: state.arena.start.x - PLAYER_W / 2 + i * SPAWN_STAGGER_PX - span / 2,
    y: state.arena.start.y - PLAYER_H,
    vx: 0,
    vy: 0,
    alive: true,
    finished: false,
    finishedAt: 0,
    diedAt: 0,
    deathPos: null,
    killedBy: -1,
    contact: "none",
    timeSinceGrounded: 0,
    jumpBuffer: 0,
    jumpHeld: false,
    jumpAge: 0,
    roundCoins: 0,
    diamondsThisRound: 0,
  }));
}

export function raceIsCountdown(state: GameState): boolean {
  // First RACE_COUNTDOWN_MS of the phaseTimer is the countdown window.
  const elapsed = RACE_COUNTDOWN_MS + RACE_MAX_MS - state.phaseTimer;
  return elapsed < RACE_COUNTDOWN_MS;
}

/** ms remaining in the pre-race countdown (or 0 if past). */
export function countdownRemainingMs(state: GameState): number {
  if (state.phase !== "race") return 0;
  return Math.max(0, state.phaseTimer - RACE_MAX_MS);
}

export function raceTimeLeftMs(state: GameState): number {
  return Math.max(0, state.phaseTimer - 0);
}

/* -------------------------------------------------------------------------- */
/*  Tick                                                                      */
/* -------------------------------------------------------------------------- */

/** Returns the round outcome if the race should end this tick. */
export function tickRace(
  state: GameState,
  frames: PlayerFrame[],
  dtMs: number,
): RoundOutcome | null {
  state.phaseTimer = Math.max(0, state.phaseTimer - dtMs);
  const countdown = raceIsCountdown(state);

  if (!countdown) {
    advancePhysics(state, frames, dtMs);
    advanceWorldObjects(state, dtMs);
    resolveContacts(state);
  }
  // VFX always tick so post-death bursts still play out during the brief
  // window between the last death and the score phase.
  tickVfx(state, dtMs);

  return checkRoundEnd(state);
}

/* -------------------------------------------------------------------------- */
/*  VFX                                                                       */
/* -------------------------------------------------------------------------- */

function tickVfx(state: GameState, dtMs: number): void {
  const dtSec = dtMs / 1000;
  for (const f of state.floats) {
    f.life -= dtMs;
    f.y += f.vy * dtSec;
  }
  state.floats = state.floats.filter((f) => f.life > 0);

  for (const p of state.particles) {
    p.life -= dtMs;
    p.vy += PARTICLE_GRAVITY * dtSec;
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

/** Spawn a floating score popup at a world position. */
export function spawnFloat(
  state: GameState,
  x: number,
  y: number,
  text: string,
  color: string,
): void {
  state.floats.push({
    x,
    y,
    vy: -FLOAT_RISE_SPEED,
    text,
    color,
    life: FLOAT_LIFE_MS,
    maxLife: FLOAT_LIFE_MS,
  });
}

/** Spawn a particle burst at a world position. */
export function spawnBurst(state: GameState, x: number, y: number, color: string): void {
  for (let i = 0; i < PARTICLE_BURST_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_BURST_COUNT;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * PARTICLE_SPEED,
      vy: Math.sin(angle) * PARTICLE_SPEED * 0.7 - PARTICLE_SPEED * 0.3,
      color,
      life: PARTICLE_LIFE_MS,
      maxLife: PARTICLE_LIFE_MS,
    });
  }
}

function advancePhysics(state: GameState, frames: PlayerFrame[], dtMs: number): void {
  // Fixed-timestep with substeps. We always run at least 1 step.
  let remaining = dtMs;
  let steps = 0;
  while (remaining > 0 && steps < MAX_SUBSTEPS) {
    const step = Math.min(remaining, FIXED_MS);
    for (const actor of state.actors) {
      if (!actor.alive || actor.finished) continue;
      const frame = frames.find((f) => f.slot === actor.slot);
      if (!frame) continue;
      stepActor(actor, frame, state.arena.solids, state.pieces, step);
    }
    remaining -= step;
    steps++;
  }
}

/* -------------------------------------------------------------------------- */
/*  World object dynamics                                                     */
/* -------------------------------------------------------------------------- */

function advanceWorldObjects(state: GameState, dtMs: number): void {
  tickMovers(state, dtMs);
}

/* -------------------------------------------------------------------------- */
/*  Contact resolution                                                        */
/* -------------------------------------------------------------------------- */

function resolveContacts(state: GameState): void {
  for (const actor of state.actors) {
    if (!actor.alive || actor.finished) continue;
    const bounds: Aabb = { x: actor.x, y: actor.y, w: PLAYER_W, h: PLAYER_H };

    // Kill line
    if (actor.y >= state.arena.killLineY) {
      killActor(state, actor, -1);
      continue;
    }

    // Pieces: bouncy / conveyor / trampoline post-effects, scorers, hazards.
    for (const piece of state.pieces) {
      const def = PIECES[piece.pieceId];
      const aabb = pieceAabb(piece);
      if (!overlaps(bounds, aabb)) continue;

      switch (piece.pieceId) {
        case "coin":
        case "diamond":
          collectScorer(state, actor, piece);
          break;
        case "bouncy":
          if (actor.vy >= 0) actor.vy = -400;
          break;
        case "trampoline":
          if (actor.vy >= 0) actor.vy = -600;
          break;
        case "conveyor": {
          // Standing on top: nudge horizontally. Direction is rot-dependent.
          const onTop = actor.y + PLAYER_H <= aabb.y + 2;
          if (onTop) {
            const dir = piece.rot === 2 ? -1 : 1;
            actor.vx += dir * 200 * 0.016; // small per-frame push
          }
          break;
        }
        case "spike": {
          // Lethal only from above.
          const fromAbove = actor.vy > 0 && actor.y + PLAYER_H <= aabb.y + 6;
          if (fromAbove) killActor(state, actor, piece.placedBy);
          break;
        }
        default:
          if (def.lethal && pieceIsLethal(piece, state.runtime.get(piece.uid))) {
            killActor(state, actor, piece.placedBy);
          }
          break;
      }
      if (!actor.alive) break;
    }

    if (!actor.alive) continue;

    // Goal
    if (overlaps(bounds, state.arena.goal)) {
      actor.finished = true;
      actor.finishedAt = Date.now();
      const player = state.players.find((p) => p.slot === actor.slot);
      if (player) {
        player.score.finishes++;
        player.score.finalScore += SCORE_FINISH;
        spawnFloat(state, actor.x + PLAYER_W / 2, actor.y, `+${SCORE_FINISH}`, player.color);
      }
    }
  }
}

function collectScorer(state: GameState, actor: RaceActor, piece: PlacedPiece): void {
  // Remove the scorer so it can only be collected once per round.
  const idx = state.pieces.findIndex((p) => p.uid === piece.uid);
  if (idx < 0) return;
  state.pieces.splice(idx, 1);

  const player = state.players.find((p) => p.slot === actor.slot);
  if (!player) return;
  if (piece.pieceId === "coin") {
    actor.roundCoins++;
    player.score.coinsCollected++;
    player.score.finalScore += SCORE_COIN;
    spawnFloat(state, actor.x + PLAYER_W / 2, actor.y, `+${SCORE_COIN}`, "#f5d24a");
  } else if (piece.pieceId === "diamond") {
    actor.diamondsThisRound++;
    player.score.diamondsCollected++;
    player.score.finalScore += SCORE_DIAMOND;
    spawnFloat(state, actor.x + PLAYER_W / 2, actor.y, `+${SCORE_DIAMOND}`, "#67e8f9");
  }
}

function killActor(state: GameState, actor: RaceActor, killedBySlot: number): void {
  actor.alive = false;
  actor.diedAt = Date.now();
  actor.deathPos = { x: actor.x, y: actor.y };
  actor.killedBy = killedBySlot;

  const dying = state.players.find((p) => p.slot === actor.slot);
  if (dying) {
    dying.score.deaths++;
    spawnBurst(state, actor.x + PLAYER_W / 2, actor.y + PLAYER_H / 2, dying.color);
  }

  if (killedBySlot >= 0) {
    if (killedBySlot === actor.slot) {
      if (dying) dying.score.selfKills++;
    } else {
      const killer = state.players.find((p) => p.slot === killedBySlot);
      if (killer) {
        killer.score.killsCaused++;
        killer.score.finalScore += SCORE_TRAP_KILL;
        spawnFloat(
          state,
          actor.x + PLAYER_W / 2,
          actor.y,
          `+${SCORE_TRAP_KILL} TRAP KILL`,
          killer.color,
        );
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  End-of-round detection                                                    */
/* -------------------------------------------------------------------------- */

function checkRoundEnd(state: GameState): RoundOutcome | null {
  const alive = state.actors.filter((a) => a.alive && !a.finished);
  const finished = state.actors.filter((a) => a.finished);

  if (alive.length === 0 && finished.length === 0) return "all_dead";
  if (alive.length === 0 && finished.length > 0) return "all_finished";

  if (state.phaseTimer <= 0) return "timeout";

  return null;
}

/* -------------------------------------------------------------------------- */
/*  Round-end bookkeeping (called by score phase)                             */
/* -------------------------------------------------------------------------- */

/** Compute per-slot points awarded *this round* and award bonuses. */
export function finalizeRound(state: GameState, outcome: RoundOutcome): RoundLog {
  const delta = new Map<number, number>();
  for (const actor of state.actors) delta.set(actor.slot, 0);

  // Sum up the per-actor scoring already applied to player.score during the
  // race (finishes, coins, diamonds, kills). For the round log we just snap
  // the delta = current score - score_at_round_start.
  // Because we don't snapshot prior score in this scaffold, we approximate
  // round delta from per-actor counters touched this round.
  for (const actor of state.actors) {
    let d = 0;
    if (actor.finished) d += SCORE_FINISH;
    d += actor.roundCoins * SCORE_COIN;
    d += actor.diamondsThisRound * SCORE_DIAMOND;
    if (actor.killedBy >= 0 && actor.killedBy !== actor.slot) {
      const trapDelta = delta.get(actor.killedBy) ?? 0;
      delta.set(actor.killedBy, trapDelta + SCORE_TRAP_KILL);
    }
    delta.set(actor.slot, (delta.get(actor.slot) ?? 0) + d);
  }

  // Lone-survivor bonus
  const finishers = state.actors.filter((a) => a.finished);
  if (finishers.length === 1 && state.actors.length > 1) {
    const lone = finishers[0];
    const player = state.players.find((p) => p.slot === lone.slot);
    if (player) {
      player.score.loneSurvivor++;
      player.score.finalScore += SCORE_LONE_SURVIVOR;
      spawnFloat(
        state,
        lone.x + PLAYER_W / 2,
        lone.y - 24,
        `+${SCORE_LONE_SURVIVOR} LONE SURVIVOR`,
        player.color,
      );
    }
    delta.set(lone.slot, (delta.get(lone.slot) ?? 0) + SCORE_LONE_SURVIVOR);
  }

  // Round-winner bookkeeping.
  let topSlot = -1;
  let topDelta = -Infinity;
  let tie = false;
  for (const [slot, d] of delta) {
    if (d > topDelta) {
      topDelta = d;
      topSlot = slot;
      tie = false;
    } else if (d === topDelta) {
      tie = true;
    }
  }
  if (!tie && topSlot >= 0 && topDelta > 0) {
    const winner = state.players.find((p) => p.slot === topSlot);
    if (winner) winner.score.roundsWon++;
  }

  return { arenaId: state.arena.id, outcome, delta };
}
