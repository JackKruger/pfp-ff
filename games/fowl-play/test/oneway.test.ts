import { describe, expect, it } from "vitest";
import { stepActor } from "../src/physics/player.js";
import { PLAYER_H } from "../src/constants.js";
import { makeFrame, type PlayerFrame, type RaceActor } from "../src/types.js";

function makeActor(): RaceActor {
  return {
    slot: 0,
    x: 100,
    y: 100,
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

describe("one-way drop-through platforms", () => {
  it("an actor falling from above lands on the platform", () => {
    const actor = makeActor();
    const platform = { x: 0, y: 200, w: 1000, h: 12 };
    const frame: PlayerFrame = makeFrame(0);
    actor.x = 100;
    actor.y = 100; // 76px above platform top
    for (let i = 0; i < 30; i++) stepActor(actor, frame, [FLOOR], [], 16, [platform]);
    expect(actor.y + PLAYER_H).toBeCloseTo(platform.y, 0);
    expect(actor.contact).toBe("ground");
  });

  it("an actor jumping up passes through the platform", () => {
    const actor = makeActor();
    const platform = { x: 0, y: 100, w: 1000, h: 12 };
    actor.x = 100;
    actor.y = 200; // below the platform
    actor.vy = -700; // jumping up
    const frame: PlayerFrame = { ...makeFrame(0), jumpHeld: true };
    // Step through. The actor must clear the platform without colliding.
    let passedThrough = false;
    for (let i = 0; i < 20; i++) {
      stepActor(actor, frame, [FLOOR], [], 16, [platform]);
      if (actor.y + PLAYER_H < platform.y) passedThrough = true;
    }
    expect(passedThrough).toBe(true);
  });

  it("does not interfere when no one-way platforms are passed", () => {
    const actor = makeActor();
    const frame: PlayerFrame = makeFrame(0);
    for (let i = 0; i < 10; i++) stepActor(actor, frame, [FLOOR], [], 16);
    expect(actor.y).toBeGreaterThan(100);
  });
});
