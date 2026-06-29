import { describe, expect, it } from "vitest";
import { beginScore, tickScore } from "../src/phases/score.js";
import { SCORE_MS } from "../src/constants.js";
import { makeEmptyPlayerScore, type GameState, type RoundLog } from "../src/types.js";

function makeState(): GameState {
  return {
    phase: "race",
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
    players: [
      {
        slot: 0,
        profileId: null,
        displayName: "P1",
        color: "#ef4444",
        gamepadIndex: 0,
        active: true,
        score: makeEmptyPlayerScore(),
      },
    ],
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
    config: { winScore: 9, handSize: 5, arenaPool: "all" },
    lastRound: null,
    history: [],
    nextUid: 1,
    startedAt: 0,
    showLookAroundHint: false,
  };
}

function makeLog(): RoundLog {
  return { arenaId: "x", outcome: "all_finished", delta: new Map([[0, 3]]) };
}

describe("beginScore", () => {
  it("transitions phase, sets timer, stores log, appends to history", () => {
    const state = makeState();
    const log = makeLog();
    beginScore(state, log);
    expect(state.phase).toBe("score");
    expect(state.phaseTimer).toBe(SCORE_MS);
    expect(state.lastRound).toBe(log);
    expect(state.history).toContain(log);
  });
});

describe("tickScore", () => {
  it("decrements the timer and returns false while time remains", () => {
    const state = makeState();
    beginScore(state, makeLog());
    expect(tickScore(state, 100)).toBe(false);
    expect(state.phaseTimer).toBe(SCORE_MS - 100);
  });

  it("returns true once the timer hits 0", () => {
    const state = makeState();
    beginScore(state, makeLog());
    expect(tickScore(state, SCORE_MS + 1)).toBe(true);
    expect(state.phaseTimer).toBe(0);
  });
});
