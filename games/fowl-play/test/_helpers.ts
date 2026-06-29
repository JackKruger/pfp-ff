import { HAND_SIZE, WIN_SCORE } from "../src/constants.js";
import {
  makeEmptyPlayerScore,
  type Arena,
  type GameState,
  type Player,
} from "../src/types.js";

/**
 * Builds a minimum-viable GameState for tests so adding a new field doesn't
 * require touching every fixture. Pass overrides to customise.
 */
export function buildTestState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: "placement",
    phaseTimer: 0,
    round: 1,
    arena: stubArena(),
    players: [],
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
    config: { winScore: WIN_SCORE, handSize: HAND_SIZE, arenaPool: "all" },
    lastRound: null,
    history: [],
    nextUid: 1,
    startedAt: 0,
    showLookAroundHint: false,
    ...overrides,
  };
}

/** Small in-bounds arena suitable for any unit-test scenario that doesn't
 *  care about the layout. */
export function stubArena(): Arena {
  return {
    id: "stub",
    name: "Stub",
    bounds: { x: -1000, y: -1000, w: 4000, h: 4000 },
    killLineY: 2000,
    start: { x: 0, y: 0 },
    goal: { x: 1, y: 1, w: 1, h: 1 },
    solids: [],
    scorers: [],
    noGoZones: [],
  };
}

export function buildPlayer(slot: number, overrides: Partial<Player> = {}): Player {
  return {
    slot,
    profileId: null,
    displayName: `P${slot + 1}`,
    color: "#ffffff",
    gamepadIndex: slot,
    active: true,
    score: makeEmptyPlayerScore(),
    ...overrides,
  };
}
