import type { LaunchContext } from "@pfp/sdk";
import {
  FINAL_CONFETTI_MS,
  FINAL_HOLD_MS,
  HAND_SIZE,
  LOOK_AROUND_MS,
  RACE_COUNTDOWN_MS,
  ROUND_LOOK_MS,
  SUDDEN_DEATH_LOOK_MS,
  WIN_SCORE,
} from "./constants.js";
import { ARENAS } from "./arenas/index.js";
import { beginLevelSelect, tickLevelSelect } from "./phases/levelSelect.js";
import { beginPlacement, tickPlacement } from "./phases/placement.js";
import {
  beginRace,
  countdownRemainingMs,
  finalizeRound,
  tickRace,
  emitConfetti,
} from "./phases/race.js";
import { beginScore, computeStandings, matchIsOver, tickScore } from "./phases/score.js";
import {
  makePlayers,
  type GameConfig,
  type GameState,
  type PlayerFrame,
} from "./types.js";
import { makePlaced } from "./pieces/registry.js";

/* -------------------------------------------------------------------------- */
/*  Construction                                                              */
/* -------------------------------------------------------------------------- */

export function createGame(launch: LaunchContext): GameState {
  const players = makePlayers(launch);
  const config = parseConfig(launch.settings);

  const state: GameState = {
    phase: "levelSelect",
    phaseTimer: 0,
    round: 1,
    arena: ARENAS[0],
    players,
    pieces: [],
    actors: [],
    cursors: [],
    runtime: new Map(),
    floats: [],
    particles: [],
    toasts: [],
    goalPulses: [],
    soundEvents: [],
    paused: false,
    config,
    lastRound: null,
    history: [],
    nextUid: 1,
    startedAt: Date.now(),
    showLookAroundHint: true,
    suddenDeath: false,
    pendingHandSeed: Date.now() & 0x7fffffff,
    finalConfettiAcc: 0,
  };

  // Players pick the arena before round 1; scorers are seeded once they confirm.
  beginLevelSelect(state);
  return state;
}

/**
 * Coerces launch.settings (free-form `Record<string, unknown>`) into a strongly
 * typed GameConfig, falling back to defaults for missing or malformed values.
 */
function parseConfig(settings: Record<string, unknown>): GameConfig {
  const winScore = Number.parseInt(String(settings.winScore ?? WIN_SCORE), 10);
  const handSize = Number.parseInt(String(settings.handSize ?? HAND_SIZE), 10);
  return {
    winScore: Number.isFinite(winScore) && winScore > 0 ? winScore : WIN_SCORE,
    handSize: Number.isFinite(handSize) && handSize > 0 ? handSize : HAND_SIZE,
  };
}

function seedArenaScorers(state: GameState): void {
  // Place coin/diamond entities into state.pieces with placedBy = -1.
  for (const s of state.arena.scorers) {
    state.pieces.push(makePlaced(state.nextUid++, s.pieceId, s.x, s.y, 0, -1));
  }
}

/* -------------------------------------------------------------------------- */
/*  Advance                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Advance the top-level FSM by `dtMs`. Returns `true` once the match ends so
 * the bootstrap can read final standings and call `client.gameOver`.
 */
export function advance(state: GameState, frames: PlayerFrame[], dtMs: number): boolean {
  switch (state.phase) {
    case "levelSelect": {
      const confirmed = tickLevelSelect(state, frames);
      if (confirmed) {
        seedArenaScorers(state);
        state.phase = "intro";
        state.phaseTimer = LOOK_AROUND_MS;
        state.showLookAroundHint = true;
        state.pendingHandSeed = Date.now() & 0x7fffffff;
        state.soundEvents.push("go");
      }
      return false;
    }

    case "intro": {
      state.phaseTimer = Math.max(0, state.phaseTimer - dtMs);
      if (state.phaseTimer <= 0) {
        if (state.suddenDeath) {
          // Tie at the win threshold — skip placement; race on the existing board.
          beginRace(state);
        } else {
          beginPlacement(state, state.pendingHandSeed);
        }
        state.showLookAroundHint = false;
      }
      return false;
    }

    case "placement": {
      const done = tickPlacement(state, frames, dtMs);
      if (done) beginRace(state);
      return false;
    }

    case "race": {
      // Emit a "countdownTick" event each time the countdown ticks past a
      // second boundary, plus a "go" event on the last edge. The race phase
      // owns the timer so the FSM is the right place to detect the edges.
      const remainingBefore = countdownRemainingMs(state);
      const outcome = tickRace(state, frames, dtMs);
      const remainingAfter = countdownRemainingMs(state);
      const beforeSec = Math.ceil(remainingBefore / 1000);
      const afterSec = Math.ceil(remainingAfter / 1000);
      if (
        remainingBefore > 0 &&
        afterSec < beforeSec &&
        afterSec >= 1 &&
        beforeSec <= Math.ceil(RACE_COUNTDOWN_MS / 1000)
      ) {
        state.soundEvents.push("countdownTick");
      }
      if (remainingBefore > 0 && remainingAfter === 0) state.soundEvents.push("go");
      if (outcome) {
        const log = finalizeRound(state, outcome);
        beginScore(state, log);
      }
      return false;
    }

    case "score": {
      const done = tickScore(state, dtMs);
      if (!done) return false;
      if (matchIsOver(state) && hasClearWinner(state)) {
        beginFinal(state);
        return false;
      }
      // Next round — UCH-style: stay on the same arena and keep every
      // player-placed piece so the map gets more chaotic each round. Only the
      // arena's coins/diamond (placedBy === -1) are cleared and respawned.
      state.round++;
      state.pieces = state.pieces.filter((p) => p.placedBy !== -1);
      seedArenaScorers(state);

      // Detect / latch sudden death: someone hit the win score but a tie
      // prevented a clean finish. Skip placement and run no-place races until
      // the tie breaks. Otherwise insert a short look-around before placement.
      if (matchIsOver(state)) state.suddenDeath = true;
      state.phase = "intro";
      state.phaseTimer = state.suddenDeath ? SUDDEN_DEATH_LOOK_MS : ROUND_LOOK_MS;
      state.pendingHandSeed = (Date.now() + state.round) & 0x7fffffff;
      state.showLookAroundHint = false;
      return false;
    }

    case "final": {
      state.phaseTimer = Math.max(0, state.phaseTimer - dtMs);
      tickFinalCelebration(state, dtMs);
      // First 1.5s of the celebration is "locked" so a held A press from the
      // last round can't insta-skip the winner reveal. After that, either the
      // timer expires or any player taps A to continue.
      const inGrace = state.phaseTimer > FINAL_HOLD_MS - 1500;
      if (inGrace) return false;
      const skipPressed = frames.some((f) => f.confirmDown);
      return state.phaseTimer <= 0 || skipPressed;
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Final phase                                                               */
/* -------------------------------------------------------------------------- */

function beginFinal(state: GameState): void {
  state.phase = "final";
  state.phaseTimer = FINAL_HOLD_MS;
  state.soundEvents.push("win");
  state.toasts = [];
  state.particles = [];
  state.floats = [];
  state.finalConfettiAcc = 0;
  state.screenShake = Math.max(state.screenShake ?? 0, 12);
  // Burst on entry so the celebration starts feeling alive without a pause.
  emitConfetti(state, 28);
}

function tickFinalCelebration(state: GameState, dtMs: number): void {
  if ((state.screenShake ?? 0) > 0) {
    state.screenShake = Math.max(0, (state.screenShake ?? 0) - dtMs * 0.04);
  }
  state.finalConfettiAcc += dtMs;
  while (state.finalConfettiAcc >= FINAL_CONFETTI_MS) {
    emitConfetti(state, 6);
    state.finalConfettiAcc -= FINAL_CONFETTI_MS;
  }
  // Drain VFX in-place so confetti still falls and fades.
  const dtSec = dtMs / 1000;
  for (const p of state.particles) {
    p.life -= dtMs;
    p.vy += 600 * dtSec;
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

/**
 * Only end the match if there's a non-tie winner at or above the configured
 * winScore — so a tie at the threshold plays one more round. (See design §5.)
 */
function hasClearWinner(state: GameState): boolean {
  const standings = computeStandings(state);
  if (standings.length < 2) return true;
  const top = standings[0];
  const tiedAtTop = standings.filter((s) => s.rank === top.rank).length;
  if (tiedAtTop > 1) return false;
  const winner = state.players.find((p) => p.slot === top.slot);
  return !!winner && winner.score.finalScore >= state.config.winScore;
}
