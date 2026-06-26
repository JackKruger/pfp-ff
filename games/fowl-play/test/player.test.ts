import { beforeEach, describe, expect, it } from "vitest";
import { stepActor } from "../src/physics/player.js";
import { GRAVITY, JUMP_VY, PLAYER_H, PLAYER_W } from "../src/constants.js";
import { makeFrame, type PlayerFrame, type RaceActor } from "../src/types.js";

function makeActor(slot = 0): RaceActor {
  return {
    slot,
    x: 100,
    y: 0,
    vx: 0,
    vy: 0,
    alive: true,
    finished: false,
    finishedAt: 0,
    diedAt: 0,
    deathPos: null,
    killedBy: -1,
    contact: "none",
    timeSinceGrounded: 9999,
    jumpBuffer: 0,
    jumpHeld: false,
    jumpAge: 0,
    roundCoins: 0,
    diamondsThisRound: 0,
  };
}

const FLOOR = { x: 0, y: 400, w: 1000, h: 100 };

describe("player physics", () => {
  let actor: RaceActor;
  let frame: PlayerFrame;

  beforeEach(() => {
    actor = makeActor();
    frame = makeFrame(0);
  });

  it("falls under gravity", () => {
    stepActor(actor, frame, [FLOOR], [], 16);
    expect(actor.vy).toBeGreaterThan(0);
    expect(actor.vy).toBeCloseTo(GRAVITY * (1 / 60), 0);
  });

  it("lands on the floor", () => {
    actor.y = 300;
    for (let i = 0; i < 60; i++) stepActor(actor, frame, [FLOOR], [], 16);
    expect(actor.contact).toBe("ground");
    expect(actor.y + PLAYER_H).toBeCloseTo(FLOOR.y, 0);
  });

  it("variable-height jump: holding A goes higher than tapping", () => {
    // Land first.
    actor.y = 300;
    for (let i = 0; i < 60; i++) stepActor(actor, frame, [FLOOR], [], 16);
    const groundY = actor.y;

    // Tap jump: press for 1 frame then release.
    const tapActor = { ...actor };
    const tapFrame = { ...frame, jumpDown: true, jumpHeld: true };
    stepActor(tapActor, tapFrame, [FLOOR], [], 16);
    const tapFrame2 = { ...frame, jumpDown: false, jumpHeld: false };
    let tapPeak = tapActor.y;
    for (let i = 0; i < 120; i++) {
      stepActor(tapActor, tapFrame2, [FLOOR], [], 16);
      if (tapActor.y < tapPeak) tapPeak = tapActor.y;
    }

    // Hold jump: keep jumpHeld true.
    const holdActor = { ...actor };
    const holdFrame = { ...frame, jumpDown: true, jumpHeld: true };
    stepActor(holdActor, holdFrame, [FLOOR], [], 16);
    let holdPeak = holdActor.y;
    for (let i = 0; i < 120; i++) {
      stepActor(holdActor, holdFrame, [FLOOR], [], 16);
      if (holdActor.y < holdPeak) holdPeak = holdActor.y;
    }

    // Held jump should reach a higher peak (smaller y) than tapped jump.
    expect(holdPeak).toBeLessThan(tapPeak);
    expect(groundY).toBeGreaterThan(0); // sanity
  });

  it("respects max jump-height proportional to v0^2/2g", () => {
    actor.y = 300;
    for (let i = 0; i < 60; i++) stepActor(actor, frame, [FLOOR], [], 16);
    const groundY = actor.y;

    const holdFrame = { ...frame, jumpDown: true, jumpHeld: true };
    stepActor(actor, holdFrame, [FLOOR], [], 16);
    let peak = actor.y;
    for (let i = 0; i < 120; i++) {
      stepActor(actor, holdFrame, [FLOOR], [], 16);
      if (actor.y < peak) peak = actor.y;
    }
    const apex = groundY - peak;
    const theoretical = (JUMP_VY * JUMP_VY) / (2 * GRAVITY);
    // Allow up to 35% slack to account for fixed-step integration error.
    expect(apex).toBeGreaterThan(theoretical * 0.65);
    expect(apex).toBeLessThan(theoretical * 1.35);
  });

  it("collides with side wall and zeroes vx", () => {
    const wall = { x: 200, y: 0, w: 10, h: 600 };
    actor.x = 100;
    actor.y = 100;
    actor.vx = 0;
    const right = { ...frame, moveX: 1 };
    for (let i = 0; i < 60; i++) stepActor(actor, right, [wall, FLOOR], [], 16);
    expect(actor.x + PLAYER_W).toBeLessThanOrEqual(wall.x + 0.1);
    expect(actor.vx).toBe(0);
  });
});
