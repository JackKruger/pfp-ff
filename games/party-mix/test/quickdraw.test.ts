import { describe, expect, it } from "vitest";
import type { PlayerInput } from "../src/game.js";
import { quickdraw } from "../src/minigames/quickdraw.js";

const players = [
  { slot: 0, name: "P1", color: "#f00" },
  { slot: 1, name: "P2", color: "#00f" },
];

function inputs(...as: boolean[]): PlayerInput[] {
  return as.map((a) => ({ a, b: false, dx: 0, dy: 0 }));
}

describe("quickdraw", () => {
  it("ranks a false start (pressing before green) below a reaction", () => {
    const mg = quickdraw(players);
    // P2 jumps the gun immediately (well before the >=1500ms green window).
    mg.update(16, inputs(false, false));
    mg.update(16, inputs(false, true)); // P2 false start edge
    // Push past the max wait so green is definitely on, then P1 reacts.
    mg.update(4100, inputs(false, false));
    mg.update(16, inputs(true, false)); // P1 reacts after green
    // Run out the react window so P-states settle.
    mg.update(3000, inputs(false, false));

    expect(mg.done()).toBe(true);
    expect(mg.placements()).toEqual([0, 1]); // P1 (reacted) beats P2 (false start)
  });

  it("ranks two reactors by reaction time, fastest first", () => {
    const mg = quickdraw(players);
    mg.update(4100, inputs(false, false)); // green is on now
    // need a release frame before edges register
    mg.update(16, inputs(false, false));
    mg.update(50, inputs(false, true)); // P2 reacts first
    mg.update(16, inputs(false, false));
    mg.update(80, inputs(true, false)); // P1 reacts later
    mg.update(3000, inputs(false, false));

    expect(mg.done()).toBe(true);
    expect(mg.placements()[0]).toBe(1); // P2 was faster
  });
});
