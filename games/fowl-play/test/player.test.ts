import { beforeEach, describe, expect, it } from "vitest";
import { stepActor } from "../src/physics/player.js";
import { makePlaced } from "../src/pieces/registry.js";
import {
  COYOTE_MS,
  GRAVITY,
  JUMP_VY,
  PLAYER_H,
  PLAYER_W,
  WALK_MAX,
} from "../src/constants.js";
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
    killedByCause: null,
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

  it("coyote time lets you jump shortly after walking off a ledge", () => {
    // Tiny platform — one tick of horizontal motion is enough to clear it.
    const platform = { x: 100, y: 200, w: 32, h: 20 };
    actor.x = 108;
    actor.y = 100;
    for (let i = 0; i < 30; i++) stepActor(actor, frame, [platform], [], 16);
    expect(actor.contact).toBe("ground");

    // Teleport just past the right edge so we're guaranteed airborne next step.
    actor.x = platform.x + platform.w + 4;
    // One air step — should leave contact but stay inside coyote window.
    stepActor(actor, frame, [platform], [], 16);
    expect(actor.contact).not.toBe("ground");
    expect(actor.timeSinceGrounded).toBeLessThanOrEqual(COYOTE_MS);

    // Press jump within coyote.
    const jump: PlayerFrame = { ...frame, jumpDown: true, jumpHeld: true };
    stepActor(actor, jump, [platform], [], 16);
    expect(actor.vy).toBeLessThan(-JUMP_VY * 0.7);
  });

  it("jump buffer triggers a jump pressed just before landing", () => {
    // Position the actor just above the floor so it lands within the buffer
    // window (100ms). Floor top is at y=400; actor bottom = y+24, so y=370
    // means a 6px fall.
    actor.y = 370;
    const press: PlayerFrame = { ...frame, jumpDown: true, jumpHeld: true };
    stepActor(actor, press, [FLOOR], [], 16);
    expect(actor.jumpBuffer).toBeGreaterThan(0);

    // Hold jump (no fresh press) for a few steps. The actor lands within
    // a couple of frames and the buffer should consume on the first grounded
    // step after that.
    const held: PlayerFrame = { ...frame, jumpDown: false, jumpHeld: true };
    let jumpedAfterLanding = false;
    for (let i = 0; i < 6; i++) {
      const prevVy = actor.vy;
      stepActor(actor, held, [FLOOR], [], 16);
      if (prevVy >= 0 && actor.vy < -JUMP_VY * 0.5) jumpedAfterLanding = true;
    }
    expect(jumpedAfterLanding).toBe(true);
  });

  it("wall jump pushes horizontally away from the wall", () => {
    const wall = { x: 200, y: 0, w: 10, h: 600 };
    actor.x = 150;
    actor.y = 100;
    // Drive into the wall and let it settle on the right wall.
    const intoWall: PlayerFrame = { ...frame, moveX: 1, jumpHeld: false };
    for (let i = 0; i < 40; i++) stepActor(actor, intoWall, [wall, FLOOR], [], 16);
    // Set contact manually to leftWall to simulate hugging it (sweep makes contact transient).
    actor.contact = "rightWall";

    // Press jump.
    const wallJump: PlayerFrame = { ...frame, jumpDown: true, jumpHeld: true, moveX: 1 };
    stepActor(actor, wallJump, [wall, FLOOR], [], 16);
    expect(actor.vy).toBeLessThan(-100); // launched upward
    expect(actor.vx).toBeLessThan(0); // pushed away from the right wall
  });

  it("ground friction decays vx toward 0 when no input", () => {
    actor.y = 300;
    // Settle on floor, build up velocity, then release input.
    const right: PlayerFrame = { ...frame, moveX: 1 };
    for (let i = 0; i < 40; i++) stepActor(actor, right, [FLOOR], [], 16);
    expect(actor.vx).toBeGreaterThan(0);
    const peakVx = actor.vx;

    for (let i = 0; i < 40; i++) stepActor(actor, frame, [FLOOR], [], 16);
    expect(Math.abs(actor.vx)).toBeLessThan(Math.abs(peakVx));
    expect(Math.abs(actor.vx)).toBeLessThan(5); // near zero
  });

  it("walks at WALK_MAX horizontally on the ground", () => {
    actor.y = 300;
    const right: PlayerFrame = { ...frame, moveX: 1 };
    for (let i = 0; i < 120; i++) stepActor(actor, right, [FLOOR], [], 16);
    // Should approach but not exceed WALK_MAX.
    expect(actor.vx).toBeLessThanOrEqual(WALK_MAX + 1);
    expect(actor.vx).toBeGreaterThan(WALK_MAX * 0.95);
  });

  it("ice is slipperier than a normal surface", () => {
    // Two identical actors sliding with no input: one on planks, one on ice.
    // The ice actor must keep far more of its speed.
    const run = (pieceId: "plank" | "ice"): number => {
      const a = makeActor();
      const w = pieceId === "ice" ? 64 : 96;
      // A long runway of the given surface with its top at y=344.
      const pieces = Array.from({ length: 14 }, (_, i) =>
        makePlaced(i + 1, pieceId, i * w, 344, 0, 0),
      );
      a.y = 300;
      // Settle onto the surface.
      for (let i = 0; i < 30; i++) stepActor(a, frame, [], pieces, 16);
      a.vx = 280;
      for (let i = 0; i < 18; i++) stepActor(a, frame, [], pieces, 16); // ~0.3s coasting
      return a.vx;
    };
    const vxIce = run("ice");
    const vxPlank = run("plank");
    expect(vxPlank).toBeLessThan(5); // normal friction stops you fast
    expect(vxIce).toBeGreaterThan(150); // ice keeps you sliding
  });

  it("honey caps ground speed", () => {
    const pieces = Array.from({ length: 14 }, (_, i) =>
      makePlaced(i + 1, "honey", i * 64, 344, 0, 0),
    );
    actor.y = 300;
    const right: PlayerFrame = { ...frame, moveX: 1 };
    for (let i = 0; i < 90; i++) stepActor(actor, right, [], pieces, 16);
    expect(actor.vx).toBeLessThan(WALK_MAX * 0.55);
  });

  it("low-gravity modifier reduces gravity applied to actors", () => {
    const normal = makeActor();
    const floaty = makeActor();
    stepActor(normal, frame, [], [], 16);
    stepActor(floaty, frame, [], [], 16, [], { gravityMul: 0.62 });
    expect(floaty.vy).toBeLessThan(normal.vy);
  });

  it("holding down drops through a one-way platform", () => {
    const platform = { x: 0, y: 200, w: 1000, h: 12 };
    actor.x = 100;
    actor.y = 200 - PLAYER_H; // standing on the platform
    actor.vy = 0;
    const down: PlayerFrame = { ...frame, moveY: 1 };
    for (let i = 0; i < 30; i++) stepActor(actor, down, [], [], 16, [platform]);
    expect(actor.y).toBeGreaterThan(platform.y + platform.h);
  });

  it("stays put on a one-way platform without down input", () => {
    const platform = { x: 0, y: 200, w: 1000, h: 12 };
    actor.x = 100;
    actor.y = 200 - PLAYER_H;
    actor.vy = 0;
    for (let i = 0; i < 30; i++) stepActor(actor, frame, [], [], 16, [platform]);
    expect(actor.y + PLAYER_H).toBeCloseTo(platform.y, 0);
  });

  it("finished actors don't move", () => {
    actor.finished = true;
    actor.x = 100;
    actor.y = 100;
    const right: PlayerFrame = { ...frame, moveX: 1 };
    for (let i = 0; i < 30; i++) stepActor(actor, right, [FLOOR], [], 16);
    expect(actor.x).toBe(100);
    expect(actor.y).toBe(100);
  });
});
