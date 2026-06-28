import { describe, expect, it } from "vitest";
import { CAM_LERP, CAM_ZOOM_MAX, CAM_ZOOM_MIN } from "../src/constants.js";
import { lerpCamera, makeCamera, targetFor } from "../src/render/camera.js";
import { BARNYARD } from "../src/arenas/barnyard.js";
import type { GameState } from "../src/types.js";

function makeBaseState(): GameState {
  return {
    phase: "placement",
    phaseTimer: 0,
    round: 1,
    arena: BARNYARD,
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
    config: { winScore: 9, handSize: 5, arenaPool: "all" },
    lastRound: null,
    history: [],
    nextUid: 1,
    startedAt: 0,
    showLookAroundHint: false,
  };
}

describe("camera", () => {
  it("makeCamera returns the default origin / zoom", () => {
    expect(makeCamera()).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("targetFor in placement frames the arena bounds", () => {
    const state = makeBaseState();
    state.phase = "placement";
    const t = targetFor(state);
    expect(t.x).toBeCloseTo(BARNYARD.bounds.x + BARNYARD.bounds.w / 2, 0);
    expect(t.y).toBeCloseTo(BARNYARD.bounds.y + BARNYARD.bounds.h / 2, 0);
    expect(t.zoom).toBeGreaterThanOrEqual(CAM_ZOOM_MIN);
    expect(t.zoom).toBeLessThanOrEqual(CAM_ZOOM_MAX);
  });

  it("targetFor during race tightens around alive actors + start + goal", () => {
    const state = makeBaseState();
    state.phase = "race";
    state.actors = [
      {
        slot: 0,
        x: 400,
        y: 400,
        vx: 0,
        vy: 0,
        alive: true,
        finished: false,
        finishedAt: 0,
        diedAt: 0,
        deathPos: null,
        killedBy: -1,
        killedByCause: null,
        contact: "none",
        timeSinceGrounded: 0,
        jumpBuffer: 0,
        jumpHeld: false,
        jumpAge: 0,
        roundCoins: 0,
        diamondsThisRound: 0,
      },
    ];
    const t = targetFor(state);
    // Should land somewhere between the start zone and the goal.
    expect(t.x).toBeGreaterThan(BARNYARD.start.x);
    expect(t.x).toBeLessThan(BARNYARD.goal.x + BARNYARD.goal.w);
  });

  it("zoom is always clamped to [MIN, MAX]", () => {
    const state = makeBaseState();
    state.phase = "race";
    state.actors = [];
    const t = targetFor(state);
    expect(t.zoom).toBeGreaterThanOrEqual(CAM_ZOOM_MIN);
    expect(t.zoom).toBeLessThanOrEqual(CAM_ZOOM_MAX);
  });

  it("lerpCamera moves CAM_LERP of the way toward target", () => {
    const cam = { x: 0, y: 0, zoom: 1 };
    const out = lerpCamera(cam, { x: 100, y: 200, zoom: 0.5 });
    expect(out.x).toBeCloseTo(100 * CAM_LERP, 4);
    expect(out.y).toBeCloseTo(200 * CAM_LERP, 4);
    expect(out.zoom).toBeCloseTo(1 + (0.5 - 1) * CAM_LERP, 4);
  });
});
