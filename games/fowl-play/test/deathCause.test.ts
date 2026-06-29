import { describe, expect, it } from "vitest";
import { RACE_MAX_MS, TOAST_LIFE_MS } from "../src/constants.js";
import { beginRace, tickRace } from "../src/phases/race.js";
import { makePlaced } from "../src/pieces/registry.js";
import { makeFrame, type PlayerFrame } from "../src/types.js";
import { buildPlayer, buildTestState } from "./_helpers.js";

function pump(slots = 1): PlayerFrame[] {
  return Array.from({ length: slots }, (_, i) => makeFrame(i));
}

describe("death cause attribution", () => {
  it("kill-line death is recorded as 'fall'", () => {
    const state = buildTestState({
      players: [buildPlayer(0)],
      phase: "race",
    });
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].y = state.arena.killLineY + 100;
    tickRace(state, pump(), 16);
    expect(state.actors[0].killedByCause).toBe("fall");
    expect(state.actors[0].killedBy).toBe(-1);
  });

  it("spike death records 'spike' and credits the placer", () => {
    const state = buildTestState({
      players: [buildPlayer(0), buildPlayer(1)],
      phase: "race",
      pieces: [makePlaced(1, "spike", 0, 16, 0, 1)], // placed by slot 1
    });
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].x = 0;
    state.actors[0].y = -8;
    state.actors[0].vy = 200;
    tickRace(state, pump(2), 16);
    expect(state.actors[0].killedByCause).toBe("spike");
    expect(state.actors[0].killedBy).toBe(1);
  });

  it("saw death records 'saw' (always-lethal hazard)", () => {
    const state = buildTestState({
      players: [buildPlayer(0)],
      phase: "race",
      pieces: [makePlaced(1, "saw", 0, 0, 0, 0)],
    });
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].x = 0;
    state.actors[0].y = 0;
    tickRace(state, pump(), 16);
    expect(state.actors[0].killedByCause).toBe("saw");
  });

  it("queues a toast on every death", () => {
    const state = buildTestState({
      players: [buildPlayer(0, { displayName: "Alice" })],
      phase: "race",
    });
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].y = state.arena.killLineY + 100;
    tickRace(state, pump(), 16);
    expect(state.toasts.length).toBe(1);
    expect(state.toasts[0].text).toContain("Alice");
    expect(state.toasts[0].text).toContain("fell off");
    expect(state.toasts[0].life).toBeLessThanOrEqual(TOAST_LIFE_MS);
  });
});

describe("toast lifecycle", () => {
  it("toasts decay each tick and are culled past their lifetime", () => {
    const state = buildTestState({
      players: [buildPlayer(0)],
      phase: "race",
    });
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].y = state.arena.killLineY + 100;
    tickRace(state, pump(), 16);
    expect(state.toasts.length).toBe(1);

    // Run the clock past the toast's lifetime.
    for (let i = 0; i < 30; i++) tickRace(state, pump(), 100);
    expect(state.toasts.length).toBe(0);
  });
});

describe("goal pulse", () => {
  it("spawns a pulse in the finisher's color when an actor crosses the goal", () => {
    const state = buildTestState({
      players: [buildPlayer(0, { color: "#3b82f6" })],
      phase: "race",
    });
    state.arena.goal = { x: 0, y: 0, w: 32, h: 32 };
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].x = 8;
    state.actors[0].y = 8;
    tickRace(state, pump(), 16);
    expect(state.goalPulses.length).toBe(1);
    expect(state.goalPulses[0].color).toBe("#3b82f6");
  });

  it("pulses decay and are culled", () => {
    const state = buildTestState({
      players: [buildPlayer(0)],
      phase: "race",
    });
    state.arena.goal = { x: 0, y: 0, w: 32, h: 32 };
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].x = 8;
    state.actors[0].y = 8;
    tickRace(state, pump(), 16);
    expect(state.goalPulses.length).toBe(1);
    for (let i = 0; i < 20; i++) tickRace(state, pump(), 100);
    expect(state.goalPulses.length).toBe(0);
  });
});
