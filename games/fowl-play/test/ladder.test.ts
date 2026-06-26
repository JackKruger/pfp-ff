import { describe, expect, it } from "vitest";
import { stepActor } from "../src/physics/player.js";
import { makePlaced } from "../src/pieces/registry.js";
import { makeFrame, type RaceActor } from "../src/types.js";

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
    contact: "none",
    timeSinceGrounded: 9999,
    jumpBuffer: 0,
    jumpHeld: false,
    jumpAge: 0,
    roundCoins: 0,
    diamondsThisRound: 0,
  };
}

describe("ladder", () => {
  it("overrides gravity while overlapping", () => {
    const actor = makeActor();
    const ladder = makePlaced(1, "ladder", 100, 50, 0, 0); // 16x96 covering y 50..146
    const frame = makeFrame(0);
    // Multiple ticks — without a ladder we'd accumulate fall speed.
    for (let i = 0; i < 30; i++) stepActor(actor, frame, [], [ladder], 16);
    // Vertical position should be approximately unchanged (we're hanging).
    expect(Math.abs(actor.y - 100)).toBeLessThan(2);
    expect(actor.vy).toBe(0);
  });

  it("climbs up when moveY is negative", () => {
    const actor = makeActor();
    const ladder = makePlaced(1, "ladder", 100, 50, 0, 0); // y 50..146 covers actor at 100
    const frame = { ...makeFrame(0), moveY: -1 };
    const startY = actor.y;
    for (let i = 0; i < 30; i++) stepActor(actor, frame, [], [ladder], 16);
    expect(actor.y).toBeLessThan(startY - 30);
  });

  it("falls when not overlapping a ladder", () => {
    const actor = makeActor();
    const frame = makeFrame(0);
    for (let i = 0; i < 10; i++) stepActor(actor, frame, [], [], 16);
    expect(actor.vy).toBeGreaterThan(0);
    expect(actor.y).toBeGreaterThan(100);
  });
});
