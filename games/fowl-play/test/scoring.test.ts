import { describe, expect, it } from "vitest";
import { computeStandings, matchIsOver } from "../src/phases/score.js";
import { WIN_SCORE } from "../src/constants.js";
import { makeEmptyPlayerScore, type GameState, type Player } from "../src/types.js";

function makePlayer(slot: number, score: number, coins = 0, finishes = 0): Player {
  return {
    slot,
    profileId: null,
    displayName: `P${slot + 1}`,
    color: "#ffffff",
    gamepadIndex: slot,
    active: true,
    score: {
      ...makeEmptyPlayerScore(),
      finalScore: score,
      coinsCollected: coins,
      finishes,
    },
  };
}

function makeState(players: Player[]): GameState {
  return {
    phase: "score",
    phaseTimer: 0,
    round: 1,
    arena: {
      id: "x",
      name: "x",
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      killLineY: 100,
      start: { x: 0, y: 0 },
      goal: { x: 0, y: 0, w: 1, h: 1 },
      solids: [],
      scorers: [],
      noGoZones: [],
    },
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
    config: { winScore: 9, handSize: 5 },
    lastRound: null,
    history: [],
    nextUid: 1,
    startedAt: 0,
    showLookAroundHint: false,
    suddenDeath: false,
    pendingHandSeed: 0,
    finalConfettiAcc: 0,
  };
}

describe("computeStandings", () => {
  it("ranks by score descending", () => {
    const state = makeState([
      makePlayer(0, 3),
      makePlayer(1, 7),
      makePlayer(2, 5),
      makePlayer(3, 0),
    ]);
    const ranks = computeStandings(state);
    expect(ranks.find((r) => r.slot === 1)?.rank).toBe(1);
    expect(ranks.find((r) => r.slot === 2)?.rank).toBe(2);
    expect(ranks.find((r) => r.slot === 0)?.rank).toBe(3);
    expect(ranks.find((r) => r.slot === 3)?.rank).toBe(4);
  });

  it("ties share rank", () => {
    const state = makeState([makePlayer(0, 5), makePlayer(1, 5), makePlayer(2, 1)]);
    const ranks = computeStandings(state);
    expect(ranks.find((r) => r.slot === 0)?.rank).toBe(1);
    expect(ranks.find((r) => r.slot === 1)?.rank).toBe(1);
    expect(ranks.find((r) => r.slot === 2)?.rank).toBe(3);
  });

  it("breaks ties on coins, then finishes", () => {
    const state = makeState([makePlayer(0, 5, 2, 1), makePlayer(1, 5, 5, 0)]);
    const ranks = computeStandings(state);
    expect(ranks.find((r) => r.slot === 1)?.rank).toBe(1);
    expect(ranks.find((r) => r.slot === 0)?.rank).toBe(2);
  });
});

describe("matchIsOver", () => {
  it("is false before anyone reaches WIN_SCORE", () => {
    const state = makeState([makePlayer(0, WIN_SCORE - 1), makePlayer(1, 0)]);
    expect(matchIsOver(state)).toBe(false);
  });
  it("is true once someone hits WIN_SCORE", () => {
    const state = makeState([makePlayer(0, WIN_SCORE), makePlayer(1, 0)]);
    expect(matchIsOver(state)).toBe(true);
  });
});
