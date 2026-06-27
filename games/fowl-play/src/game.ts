import type { LaunchContext } from "@pfp/sdk";
import { FINAL_HOLD_MS, HAND_SIZE, LOOK_AROUND_MS, WIN_SCORE } from "./constants.js";
import { pickArena } from "./arenas/index.js";
import { beginPlacement, tickPlacement } from "./phases/placement.js";
import {
  beginRace,
  finalizeRound,
  tickRace,
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
  const arena = pickArena(1);
  const config = parseConfig(launch.settings);

  const state: GameState = {
    phase: "intro",
    phaseTimer: LOOK_AROUND_MS,
    round: 1,
    arena,
    players,
    pieces: [],
    actors: [],
    cursors: [],
    runtime: new Map(),
    floats: [],
    particles: [],
    paused: false,
    config,
    lastRound: null,
    history: [],
    nextUid: 1,
    startedAt: Date.now(),
    ended: false,
    showLookAroundHint: true,
  };

  seedArenaScorers(state);
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
    case "intro": {
      state.phaseTimer = Math.max(0, state.phaseTimer - dtMs);
      if (state.phaseTimer <= 0) {
        beginPlacement(state, Date.now() & 0x7fffffff);
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
      const outcome = tickRace(state, frames, dtMs);
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
        state.phase = "final";
        state.phaseTimer = FINAL_HOLD_MS;
        return false;
      }
      // Next round
      state.round++;
      state.arena = pickArena(state.round);
      state.pieces = [];
      seedArenaScorers(state);
      beginPlacement(state, (Date.now() + state.round) & 0x7fffffff);
      return false;
    }

    case "final": {
      state.phaseTimer = Math.max(0, state.phaseTimer - dtMs);
      return state.phaseTimer <= 0;
    }
  }
}

/**
 * Only end the match if there's a non-tie winner above WIN_SCORE — so a
 * tied-at-9 outcome plays one more round. (See design §5.)
 */
function hasClearWinner(state: GameState): boolean {
  const standings = computeStandings(state);
  if (standings.length < 2) return true;
  const top = standings[0];
  const tiedAtTop = standings.filter((s) => s.rank === top.rank).length;
  if (tiedAtTop > 1) return false;
  const winner = state.players.find((p) => p.slot === top.slot);
  return !!winner && winner.score.finalScore >= WIN_SCORE;
}
