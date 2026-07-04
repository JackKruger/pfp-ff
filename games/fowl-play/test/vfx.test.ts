import { describe, expect, it } from "vitest";
import {
  beginRace,
  finalizeRound,
  spawnBurst,
  spawnFloat,
  tickRace,
} from "../src/phases/race.js";
import {
  PARTICLE_BURST_COUNT,
  PARTICLE_LIFE_MS,
  FLOAT_LIFE_MS,
  RACE_MAX_MS,
  SPAWN_STAGGER_PX,
} from "../src/constants.js";
import { makeFrame, type PlayerFrame } from "../src/types.js";
import { buildPlayer, buildTestState } from "./_helpers.js";
import { makePlaced } from "../src/pieces/registry.js";

function pump(slots: number, frame?: Partial<PlayerFrame>): PlayerFrame[] {
  return Array.from({ length: slots }, (_, i) => ({
    ...makeFrame(i),
    ...(frame ?? {}),
  }));
}

describe("spawn stagger", () => {
  it("spaces 4 active players SPAWN_STAGGER_PX apart, centred on start", () => {
    const state = buildTestState({
      players: [0, 1, 2, 3].map((s) => buildPlayer(s)),
    });
    state.arena.start = { x: 500, y: 200 };
    beginRace(state);
    const xs = state.actors.map((a) => a.x).sort((a, b) => a - b);
    expect(xs.length).toBe(4);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeCloseTo(SPAWN_STAGGER_PX, 4);
    }
    // Center of the spread should be near the start x.
    const center = (xs[0] + xs[xs.length - 1]) / 2;
    expect(Math.abs(center - (state.arena.start.x - 12 /* half PLAYER_W */))).toBeLessThan(2);
  });

  it("a single active player spawns centred at start", () => {
    const state = buildTestState({ players: [buildPlayer(0)] });
    state.arena.start = { x: 100, y: 200 };
    beginRace(state);
    expect(state.actors[0].x).toBeCloseTo(state.arena.start.x - 12, 4);
  });
});

describe("FloatingText lifecycle", () => {
  it("spawnFloat appends a float with full life", () => {
    const state = buildTestState();
    spawnFloat(state, 10, 20, "+1", "#f5d24a");
    expect(state.floats.length).toBe(1);
    expect(state.floats[0]).toMatchObject({ x: 10, y: 20, text: "+1", color: "#f5d24a" });
    expect(state.floats[0].life).toBe(FLOAT_LIFE_MS);
  });

  it("ticks decrement life and rise the float upward", () => {
    const state = buildTestState({ players: [buildPlayer(0)], phase: "race" });
    beginRace(state);
    spawnFloat(state, 0, 100, "+1", "#fff");
    const yBefore = state.floats[0].y;
    tickRace(state, pump(1), 200);
    expect(state.floats[0].y).toBeLessThan(yBefore);
    expect(state.floats[0].life).toBeLessThan(FLOAT_LIFE_MS);
  });

  it("floats are culled once life hits 0", () => {
    const state = buildTestState({ players: [buildPlayer(0)], phase: "race" });
    beginRace(state);
    spawnFloat(state, 0, 100, "+1", "#fff");
    // Run past the float's lifetime.
    for (let i = 0; i < 12; i++) tickRace(state, pump(1), 100);
    expect(state.floats.length).toBe(0);
  });
});

describe("Particle burst lifecycle", () => {
  it("spawnBurst emits PARTICLE_BURST_COUNT particles around the point", () => {
    const state = buildTestState();
    spawnBurst(state, 100, 100, "#ef4444");
    expect(state.particles.length).toBe(PARTICLE_BURST_COUNT);
    for (const p of state.particles) {
      expect(p.color).toBe("#ef4444");
      expect(p.life).toBe(PARTICLE_LIFE_MS);
    }
  });

  it("particles fall under gravity and decay", () => {
    const state = buildTestState({ players: [buildPlayer(0)], phase: "race" });
    beginRace(state);
    spawnBurst(state, 100, 100, "#fff");
    const startY = state.particles[0].y;
    tickRace(state, pump(1), 100);
    expect(state.particles.every((p) => p.life < PARTICLE_LIFE_MS)).toBe(true);
    // After gravity, every particle's y should be larger than its starting y eventually;
    // some travel upward initially due to the upward bias, so we just check the average.
    const avgY = state.particles.reduce((a, p) => a + p.y, 0) / state.particles.length;
    expect(avgY).toBeGreaterThan(startY - 50); // hasn't flown into orbit
  });

  it("particles are fully culled past PARTICLE_LIFE_MS", () => {
    const state = buildTestState({ players: [buildPlayer(0)], phase: "race" });
    beginRace(state);
    spawnBurst(state, 100, 100, "#fff");
    for (let i = 0; i < 10; i++) tickRace(state, pump(1), 100);
    expect(state.particles.length).toBe(0);
  });
});

describe("scoring events spawn VFX", () => {
  it("coin pickup spawns a +1 float in coin gold", () => {
    const state = buildTestState({
      players: [buildPlayer(0)],
      phase: "race",
      pieces: [makePlaced(1, "coin", 0, 0, 0, -1)],
    });
    state.arena.start = { x: 0, y: 0 };
    beginRace(state);
    // Skip past the countdown without ticking VFX away.
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].x = 0;
    state.actors[0].y = 0;
    tickRace(state, pump(1), 16);
    expect(state.floats.some((f) => f.text === "+1" && f.color === "#f5d24a")).toBe(true);
  });

  it("death spawns a particle burst in the player's color", () => {
    const state = buildTestState({
      players: [buildPlayer(0, { color: "#3b82f6" })],
      phase: "race",
    });
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].y = state.arena.killLineY + 100;
    tickRace(state, pump(1), 16);
    expect(state.particles.some((p) => p.color === "#3b82f6")).toBe(true);
    expect(state.screenShake).toBeGreaterThan(0);
  });

  it("lone-survivor finalizeRound spawns a bonus float", () => {
    const state = buildTestState({
      players: [buildPlayer(0), buildPlayer(1)],
      phase: "race",
    });
    beginRace(state);
    state.actors[0].finished = true;
    state.actors[1].alive = false;
    state.actors[1].killedBy = -1;
    finalizeRound(state, "all_finished");
    expect(state.floats.some((f) => f.text.includes("LONE SURVIVOR"))).toBe(true);
  });

  it("finishing spawns a color burst and a light shake", () => {
    const state = buildTestState({
      players: [buildPlayer(0, { color: "#22c55e" })],
      phase: "race",
    });
    state.arena.goal = { x: 0, y: 0, w: 32, h: 32 };
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].x = 8;
    state.actors[0].y = 8;
    tickRace(state, pump(1), 16);
    expect(state.particles.some((p) => p.color === "#22c55e")).toBe(true);
    expect(state.screenShake).toBeGreaterThan(0);
  });
});
