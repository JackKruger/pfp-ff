import { describe, expect, it } from "vitest";
import type { PlayerInput } from "../src/game.js";
import { tugOfWar } from "../src/minigames/tug-of-war.js";
import { coinGrab } from "../src/minigames/coin-grab.js";

const players = [
  { slot: 0, name: "P1", color: "#f00" },
  { slot: 1, name: "P2", color: "#00f" },
];

function mash(...as: boolean[]): PlayerInput[] {
  return as.map((a) => ({ a, b: false, dx: 0, dy: 0 }));
}

describe("tug-of-war", () => {
  it("ranks the faster masher first", () => {
    const mg = tugOfWar(players);
    // P1 mashes 40 clean taps (release+press); P2 never presses.
    for (let i = 0; i < 40; i++) {
      mg.update(16, mash(false, false));
      mg.update(16, mash(true, false));
    }
    expect(mg.done()).toBe(true); // P1 reached the target
    expect(mg.placements()[0]).toBe(0);
  });

  it("ends on the time limit even if nobody finishes", () => {
    const mg = tugOfWar(players);
    expect(mg.done()).toBe(false);
    mg.update(20000, mash(false, false));
    expect(mg.done()).toBe(true);
  });
});

describe("coin-grab", () => {
  it("runs for its full duration then ends", () => {
    const mg = coinGrab(players);
    expect(mg.done()).toBe(false);
    mg.update(15001, [
      { a: false, b: false, dx: 0, dy: 0 },
      { a: false, b: false, dx: 0, dy: 0 },
    ]);
    expect(mg.done()).toBe(true);
    expect(mg.placements()).toHaveLength(2);
  });
});
