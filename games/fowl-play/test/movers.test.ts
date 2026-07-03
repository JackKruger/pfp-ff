import { describe, expect, it } from "vitest";
import {
  _crusher,
  _log,
  _mace,
  initRuntimeFor,
  pieceIsLethal,
  tickMovers,
} from "../src/pieces/movers.js";
import { makePlaced } from "../src/pieces/registry.js";
import type { GameState, RuntimePiece } from "../src/types.js";

function emptyState(): GameState {
  return {
    phase: "race",
    phaseTimer: 0,
    round: 1,
    arena: {
      id: "test",
      name: "test",
      bounds: { x: -1000, y: -1000, w: 4000, h: 4000 },
      killLineY: 2000,
      start: { x: 0, y: 0 },
      goal: { x: 0, y: 0, w: 1, h: 1 },
      solids: [{ x: 0, y: 800, w: 1000, h: 80 }],
      scorers: [],
      noGoZones: [],
    },
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
    config: { winScore: 9, handSize: 5 },
    lastRound: null,
    history: [],
    nextUid: 100,
    startedAt: 0,
    showLookAroundHint: false,
  };
}

describe("crusher", () => {
  it("cycles rest → drop → hold → return", () => {
    const state = emptyState();
    const piece = makePlaced(1, "crusher", 100, 100, 0, 0);
    state.pieces.push(piece);
    state.runtime.set(piece.uid, initRuntimeFor(piece)!);

    tickMovers(state, _crusher.REST - 50);
    expect(state.runtime.get(1)!.state).toBe("rest");
    expect(piece.y).toBe(100);

    tickMovers(state, _crusher.DROP);
    expect(["dropping", "down"]).toContain(state.runtime.get(1)!.state);
    expect(piece.y).toBeGreaterThan(100);

    tickMovers(state, _crusher.HOLD);
    expect(state.runtime.get(1)!.state).toBe("down");
    expect(piece.y).toBeCloseTo(100 + _crusher.DIST, 1);

    tickMovers(state, _crusher.RETURN + 10);
    // Hit next cycle's rest phase or returning.
    expect(["returning", "rest"]).toContain(state.runtime.get(1)!.state);
  });

  it("is only lethal while dropping or down", () => {
    const piece = makePlaced(1, "crusher", 0, 0, 0, 0);
    const rt: RuntimePiece = initRuntimeFor(piece)!;
    rt.state = "rest";
    expect(pieceIsLethal(piece, rt)).toBe(false);
    rt.state = "dropping";
    expect(pieceIsLethal(piece, rt)).toBe(true);
    rt.state = "down";
    expect(pieceIsLethal(piece, rt)).toBe(true);
    rt.state = "returning";
    expect(pieceIsLethal(piece, rt)).toBe(false);
  });
});

describe("mace swing", () => {
  it("produces motion sweeping a circle near the pivot", () => {
    const state = emptyState();
    const piece = makePlaced(1, "mace", 200, 200, 0, 0);
    state.pieces.push(piece);
    state.runtime.set(piece.uid, initRuntimeFor(piece)!);

    const positions: { x: number; y: number }[] = [];
    const step = _mace.PERIOD / 16;
    for (let i = 0; i < 16; i++) {
      tickMovers(state, step);
      positions.push({ x: piece.x, y: piece.y });
    }

    // Mace should have visited substantially different positions.
    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const xRange = Math.max(...xs) - Math.min(...xs);
    const yRange = Math.max(...ys) - Math.min(...ys);
    expect(xRange).toBeGreaterThan(50);
    expect(yRange).toBeGreaterThan(10);
  });
});

describe("falling log", () => {
  it("does not move during the delay window", () => {
    const state = emptyState();
    const piece = makePlaced(1, "log", 100, 0, 0, 0);
    state.pieces.push(piece);
    state.runtime.set(piece.uid, initRuntimeFor(piece)!);

    tickMovers(state, _log.DELAY - 100);
    expect(piece.y).toBe(0);
    expect(state.runtime.get(1)!.state).toBe("waiting");
  });

  it("falls after the delay and lands on a solid", () => {
    const state = emptyState();
    const piece = makePlaced(1, "log", 100, 0, 0, 0);
    state.pieces.push(piece);
    state.runtime.set(piece.uid, initRuntimeFor(piece)!);

    tickMovers(state, _log.DELAY + 16);
    // After a few more frames, the log should have a downward velocity.
    tickMovers(state, 200);
    expect(state.runtime.get(1)!.vy).toBeGreaterThan(0);
    expect(piece.y).toBeGreaterThan(0);

    // Run plenty of time — the log should eventually settle on the floor.
    for (let i = 0; i < 60; i++) tickMovers(state, 50);
    expect(state.runtime.get(1)!.state).toBe("landed");
    expect(state.runtime.get(1)!.active).toBe(false);
  });
});

describe("puck", () => {
  it("launches in the rotation direction", () => {
    const state = emptyState();
    const piece = makePlaced(1, "puck", 100, 100, 0, 0); // rot 0 = right
    state.pieces.push(piece);
    state.runtime.set(piece.uid, initRuntimeFor(piece)!);

    tickMovers(state, 16);
    expect(piece.x).toBeGreaterThan(100);

    const piece2 = makePlaced(2, "puck", 300, 100, 2, 0); // rot 2 = left
    state.pieces.push(piece2);
    state.runtime.set(piece2.uid, initRuntimeFor(piece2)!);
    tickMovers(state, 16);
    expect(piece2.x).toBeLessThan(300);
  });
});

describe("puck wind-down", () => {
  it("deactivates once friction slows it below threat speed", () => {
    const state = emptyState();
    const piece = makePlaced(1, "puck", 100, 100, 0, 0);
    state.pieces.push(piece);
    state.runtime.set(piece.uid, initRuntimeFor(piece)!);

    // Well before the 60s lifetime backstop, decay alone should retire it.
    for (let i = 0; i < 200; i++) tickMovers(state, 50); // 10s
    expect(state.runtime.get(1)!.active).toBe(false);
    expect(pieceIsLethal(piece, state.runtime.get(1))).toBe(false);
  });
});

describe("log landing on placed pieces", () => {
  it("settles on a player-placed plank instead of falling through", () => {
    const state = emptyState();
    const log = makePlaced(1, "log", 100, 0, 0, 0);
    const plank = makePlaced(2, "plank", 84, 300, 0, 0); // solid, in the path
    state.pieces.push(log, plank);
    state.runtime.set(log.uid, initRuntimeFor(log)!);

    for (let i = 0; i < 120; i++) tickMovers(state, 50);
    expect(state.runtime.get(1)!.state).toBe("landed");
    // Log (96 tall) rests on the plank top at y=300.
    expect(log.y).toBeCloseTo(300 - 96, 0);
  });
});

describe("fan", () => {
  it("applies horizontal acceleration to a player in front of it", () => {
    const state = emptyState();
    const piece = makePlaced(1, "fan", 100, 100, 0, 0); // rot 0 = blows right
    state.pieces.push(piece);
    state.runtime.set(piece.uid, initRuntimeFor(piece)!);
    state.actors.push({
      slot: 0,
      x: 220, // in front of the fan
      y: 110,
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
    });
    tickMovers(state, 100);
    expect(state.actors[0].vx).toBeGreaterThan(0);
  });
});
