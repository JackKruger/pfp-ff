import { describe, expect, it } from "vitest";
import { RACE_MAX_MS } from "../src/constants.js";
import { WINDMILL } from "../src/arenas/windmill.js";
import { bladeTip, beginRace, tickRace } from "../src/phases/race.js";
import { makeFrame, type ArenaDynamic, type PlayerFrame } from "../src/types.js";
import { buildPlayer, buildTestState } from "./_helpers.js";

function pump(slots = 1): PlayerFrame[] {
  return Array.from({ length: slots }, (_, i) => makeFrame(i));
}

describe("Windmill arena", () => {
  it("declares a rotating blade in its dynamics list", () => {
    const dyns = WINDMILL.dynamics ?? [];
    expect(dyns.length).toBe(1);
    expect(dyns[0].kind).toBe("blade");
    expect(dyns[0].length).toBeGreaterThan(0);
    expect(dyns[0].periodMs).toBeGreaterThan(0);
  });
});

describe("bladeTip", () => {
  const dyn: ArenaDynamic = {
    kind: "blade",
    pivotX: 0,
    pivotY: 0,
    length: 100,
    thickness: 16,
    periodMs: 1000,
  };

  it("starts at angle 0 (along +X) when elapsed = 0", () => {
    const tip = bladeTip(dyn, 0);
    expect(tip.x).toBeCloseTo(100, 5);
    expect(tip.y).toBeCloseTo(0, 5);
  });

  it("reaches the bottom (+Y) at a quarter period", () => {
    const tip = bladeTip(dyn, 250);
    expect(tip.x).toBeCloseTo(0, 5);
    expect(tip.y).toBeCloseTo(100, 5);
  });

  it("wraps around — 1 period later equals starting position", () => {
    const start = bladeTip(dyn, 0);
    const after = bladeTip(dyn, 1000);
    expect(after.x).toBeCloseTo(start.x, 5);
    expect(after.y).toBeCloseTo(start.y, 5);
  });
});

describe("blade lethality", () => {
  it("kills an actor standing on the blade arm and records cause 'blade'", () => {
    const state = buildTestState({
      players: [buildPlayer(0)],
      phase: "race",
    });
    state.arena = {
      ...state.arena,
      dynamics: [
        {
          kind: "blade",
          pivotX: 100,
          pivotY: 100,
          length: 200,
          thickness: 16,
          periodMs: 1000,
        },
      ],
    };
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    // Place the actor at the blade's starting tip (angle 0 = +X).
    state.actors[0].x = 100 + 200 - 12;
    state.actors[0].y = 100 - 12;
    tickRace(state, pump(), 16);
    expect(state.actors[0].alive).toBe(false);
    expect(state.actors[0].killedByCause).toBe("blade");
    expect(state.actors[0].killedBy).toBe(-1);
  });

  it("ignores actors well clear of the swept arc", () => {
    const state = buildTestState({
      players: [buildPlayer(0)],
      phase: "race",
    });
    state.arena = {
      ...state.arena,
      dynamics: [
        {
          kind: "blade",
          pivotX: 100,
          pivotY: 100,
          length: 80,
          thickness: 16,
          periodMs: 1000,
        },
      ],
    };
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    // Far beyond reach of the 80-px blade.
    state.actors[0].x = 800;
    state.actors[0].y = 800;
    tickRace(state, pump(), 16);
    expect(state.actors[0].alive).toBe(true);
  });

  it("does not run during the countdown", () => {
    const state = buildTestState({
      players: [buildPlayer(0)],
      phase: "race",
    });
    state.arena = {
      ...state.arena,
      dynamics: [
        {
          kind: "blade",
          pivotX: 100,
          pivotY: 100,
          length: 200,
          thickness: 16,
          periodMs: 1000,
        },
      ],
    };
    beginRace(state);
    // Don't skip the countdown — actor is sitting under the blade tip.
    state.actors[0].x = 100 + 200 - 12;
    state.actors[0].y = 100 - 12;
    tickRace(state, pump(), 16);
    expect(state.actors[0].alive).toBe(true);
  });
});
