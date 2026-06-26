import { describe, expect, it } from "vitest";
import { BARNYARD } from "../src/arenas/barnyard.js";
import { drawHand, probePlacement, ghostFor } from "../src/phases/placement.js";
import { HAND_POOL, makePlaced } from "../src/pieces/registry.js";
import type { GameState, PlacementCursor } from "../src/types.js";

function makeState(): GameState {
  return {
    phase: "placement",
    phaseTimer: 30_000,
    round: 1,
    arena: BARNYARD,
    players: [],
    pieces: [],
    actors: [],
    cursors: [],
    lastRound: null,
    history: [],
    nextUid: 1,
    startedAt: 0,
    ended: false,
    showLookAroundHint: false,
  };
}

function makeCursor(x: number, y: number, handIdx = 0): PlacementCursor {
  return {
    slot: 0,
    x,
    y,
    rot: 0,
    handIdx,
    hand: HAND_POOL.slice(0, 5),
    confirmed: false,
    lastPlacedUid: null,
  };
}

describe("drawHand", () => {
  it("is deterministic for a fixed seed", () => {
    const a = drawHand(42, 5);
    const b = drawHand(42, 5);
    expect(a).toEqual(b);
  });

  it("draws only from the in-hand pool", () => {
    const hand = drawHand(7, 30);
    for (const id of hand) expect(HAND_POOL).toContain(id);
  });

  it("varies output across seeds", () => {
    const a = drawHand(1, 5).join(",");
    const b = drawHand(2, 5).join(",");
    expect(a).not.toBe(b);
  });
});

describe("probePlacement", () => {
  it("rejects out-of-bounds placements", () => {
    const state = makeState();
    const cursor = makeCursor(-500, -500);
    expect(probePlacement(state, cursor).ok).toBe(false);
    expect(probePlacement(state, cursor).reason).toBe("out_of_bounds");
  });

  it("rejects placements overlapping arena solids", () => {
    const state = makeState();
    const cursor = makeCursor(200, 680); // floor segment of Barnyard
    const probe = probePlacement(state, cursor);
    expect(probe.ok).toBe(false);
    expect(probe.reason).toBe("overlap");
  });

  it("rejects placements in the no-go zone around start/goal", () => {
    const state = makeState();
    const cursor = makeCursor(BARNYARD.start.x + 8, BARNYARD.start.y - 8);
    expect(probePlacement(state, cursor).reason).toBe("no_go");
  });

  it("rejects placements overlapping another placed piece", () => {
    const state = makeState();
    const cursor = makeCursor(800, 300);
    const ghost = ghostFor(cursor);
    state.pieces.push(makePlaced(99, ghost.pieceId, ghost.x, ghost.y, 0, 1));
    expect(probePlacement(state, cursor).reason).toBe("overlap");
  });

  it("accepts a clear placement", () => {
    const state = makeState();
    const cursor = makeCursor(800, 300);
    expect(probePlacement(state, cursor).ok).toBe(true);
  });
});

describe("ghostFor", () => {
  it("snaps positions to the 16-px grid", () => {
    const cursor = makeCursor(801, 311);
    const ghost = ghostFor(cursor);
    expect(ghost.x % 16).toBe(0);
    expect(ghost.y % 16).toBe(0);
  });
});
