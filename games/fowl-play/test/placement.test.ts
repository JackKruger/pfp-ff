import { describe, expect, it } from "vitest";
import { BARNYARD } from "../src/arenas/barnyard.js";
import {
  beginPlacement,
  drawHand,
  ghostFor,
  pieceForCursor,
  probePlacement,
  tickPlacement,
} from "../src/phases/placement.js";
import { HAND_POOL, makePlaced } from "../src/pieces/registry.js";
import {
  makeEmptyPlayerScore,
  makeFrame,
  type GameState,
  type PieceId,
  type Player,
  type PlacementCursor,
} from "../src/types.js";

function makePlayer(slot: number): Player {
  return {
    slot,
    profileId: null,
    displayName: `P${slot + 1}`,
    color: "#ef4444",
    gamepadIndex: slot,
    active: true,
    score: makeEmptyPlayerScore(),
  };
}

function makeState(players: Player[] = []): GameState {
  return {
    phase: "placement",
    phaseTimer: 30_000,
    round: 1,
    arena: BARNYARD,
    players,
    pieces: [],
    actors: [],
    cursors: [],
    runtime: new Map(),
    floats: [],
    particles: [],
    toasts: [],
    goalPulses: [],
    soundEvents: [],
    paused: false,
    config: { winScore: 9, handSize: 5 },
    lastRound: null,
    history: [],
    nextUid: 1,
    startedAt: 0,
    showLookAroundHint: false,
    suddenDeath: false,
    pendingHandSeed: 0,
    finalConfettiAcc: 0,
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

  it("never deals duplicate pieces while the pool lasts", () => {
    for (const seed of [1, 7, 42, 12345]) {
      const hand = drawHand(seed, 5);
      expect(new Set(hand).size).toBe(hand.length);
    }
    // Even a full-pool hand stays duplicate-free.
    const full = drawHand(3, HAND_POOL.length);
    expect(new Set(full).size).toBe(HAND_POOL.length);
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

  it("propagates the cursor's selected piece + rotation + slot", () => {
    const cursor: PlacementCursor = {
      slot: 2,
      x: 400,
      y: 300,
      rot: 1,
      handIdx: 1,
      hand: ["plank", "spike", "block"],
      confirmed: false,
      lastPlacedUid: null,
    };
    const g = ghostFor(cursor);
    expect(g.pieceId).toBe("spike");
    expect(g.rot).toBe(1);
    expect(g.placedBy).toBe(2);
  });
});

describe("beginPlacement", () => {
  it("creates a cursor per active player and draws hands", () => {
    const state = makeState([makePlayer(0), makePlayer(1), makePlayer(2)]);
    beginPlacement(state, 42);
    expect(state.cursors.length).toBe(3);
    expect(state.cursors.every((c) => c.hand.length === 5)).toBe(true);
    expect(state.cursors.every((c) => !c.confirmed)).toBe(true);
    expect(state.phase).toBe("placement");
    expect(state.phaseTimer).toBeGreaterThan(0);
  });

  it("skips inactive players", () => {
    const players = [makePlayer(0), makePlayer(1)];
    players[1].active = false;
    const state = makeState(players);
    beginPlacement(state, 7);
    expect(state.cursors.length).toBe(1);
    expect(state.cursors[0].slot).toBe(0);
  });

  it("gives different slots different hands (per-slot seed offset)", () => {
    const state = makeState([makePlayer(0), makePlayer(1)]);
    beginPlacement(state, 42);
    expect(state.cursors[0].hand.join(",")).not.toBe(state.cursors[1].hand.join(","));
  });
});

describe("tickPlacement", () => {
  it("moves the cursor with stick input", () => {
    const state = makeState([makePlayer(0)]);
    beginPlacement(state, 1);
    const c = state.cursors[0];
    const startX = c.x;
    const frame = { ...makeFrame(0), moveX: 1 };
    tickPlacement(state, [frame], 100);
    expect(c.x).toBeGreaterThan(startX);
  });

  it("cycles pieces forward with X and backward with Y", () => {
    const state = makeState([makePlayer(0)]);
    beginPlacement(state, 1);
    const c = state.cursors[0];
    c.handIdx = 0;
    tickPlacement(state, [{ ...makeFrame(0), nextDown: true }], 16);
    expect(c.handIdx).toBe(1);
    tickPlacement(state, [{ ...makeFrame(0), prevDown: true }], 16);
    expect(c.handIdx).toBe(0);
    tickPlacement(state, [{ ...makeFrame(0), prevDown: true }], 16);
    expect(c.handIdx).toBe(c.hand.length - 1); // wraps
  });

  it("rotates rotatable pieces with bumpers", () => {
    const state = makeState([makePlayer(0)]);
    beginPlacement(state, 1);
    const c = state.cursors[0];
    // Force a rotatable piece into selection.
    c.hand = ["plank", "block"];
    c.handIdx = 0;
    tickPlacement(state, [{ ...makeFrame(0), rotCwDown: true }], 16);
    expect(c.rot).toBe(1);
    tickPlacement(state, [{ ...makeFrame(0), rotCwDown: true }], 16);
    expect(c.rot).toBe(2);
    tickPlacement(state, [{ ...makeFrame(0), rotCcwDown: true }], 16);
    expect(c.rot).toBe(1);
  });

  it("forces rotation to 0 for non-rotatable pieces", () => {
    const state = makeState([makePlayer(0)]);
    beginPlacement(state, 1);
    const c = state.cursors[0];
    c.hand = ["block"]; // not rotatable
    c.handIdx = 0;
    c.rot = 0;
    tickPlacement(state, [{ ...makeFrame(0), rotCwDown: true }], 16);
    expect(c.rot).toBe(0);
  });

  it("confirm places a piece, marks ready, increments trapsPlaced", () => {
    const players = [makePlayer(0)];
    const state = makeState(players);
    beginPlacement(state, 1);
    const c = state.cursors[0];
    c.hand = ["plank"];
    c.handIdx = 0;
    c.x = 800;
    c.y = 300;
    c.rot = 0;
    tickPlacement(state, [{ ...makeFrame(0), confirmDown: true }], 16);
    expect(c.confirmed).toBe(true);
    expect(c.lastPlacedUid).not.toBeNull();
    expect(state.pieces.length).toBe(1);
    expect(players[0].score.trapsPlaced).toBe(1);
    expect(players[0].score.piecesByType.plank).toBe(1);
  });

  it("cancel after confirm removes the placed piece and re-arms the cursor", () => {
    const players = [makePlayer(0)];
    const state = makeState(players);
    beginPlacement(state, 1);
    const c = state.cursors[0];
    c.hand = ["plank"];
    c.handIdx = 0;
    c.x = 800;
    c.y = 300;
    tickPlacement(state, [{ ...makeFrame(0), confirmDown: true }], 16);
    expect(state.pieces.length).toBe(1);
    tickPlacement(state, [{ ...makeFrame(0), cancelDown: true }], 16);
    expect(state.pieces.length).toBe(0);
    expect(c.confirmed).toBe(false);
    expect(c.lastPlacedUid).toBeNull();
  });

  // Regression: cancelOwnPlacement used to leave trapsPlaced / piecesByType
  // inflated, so place→cancel→place→cancel showed trapsPlaced=4 with zero
  // pieces in the world.
  it("cancel refunds trapsPlaced and piecesByType", () => {
    const players = [makePlayer(0)];
    const state = makeState(players);
    beginPlacement(state, 1);
    const c = state.cursors[0];
    c.hand = ["plank"];
    c.handIdx = 0;
    c.x = 800;
    c.y = 300;

    for (let round = 0; round < 3; round++) {
      tickPlacement(state, [{ ...makeFrame(0), confirmDown: true }], 16);
      tickPlacement(state, [{ ...makeFrame(0), cancelDown: true }], 16);
    }
    expect(state.pieces.length).toBe(0);
    expect(players[0].score.trapsPlaced).toBe(0);
    expect(players[0].score.piecesByType.plank).toBeUndefined();
  });

  it("Start marks ready without placing", () => {
    const state = makeState([makePlayer(0)]);
    beginPlacement(state, 1);
    const c = state.cursors[0];
    tickPlacement(state, [{ ...makeFrame(0), startDown: true }], 16);
    expect(c.confirmed).toBe(true);
    expect(state.pieces.length).toBe(0);
  });

  it("returns true when all cursors are ready", () => {
    const state = makeState([makePlayer(0), makePlayer(1)]);
    beginPlacement(state, 1);
    const done = tickPlacement(
      state,
      [
        { ...makeFrame(0), startDown: true },
        { ...makeFrame(1), startDown: true },
      ],
      16,
    );
    expect(done).toBe(true);
  });

  it("returns true once the timer hits zero", () => {
    const state = makeState([makePlayer(0)]);
    beginPlacement(state, 1);
    state.phaseTimer = 16;
    const done = tickPlacement(state, [makeFrame(0)], 32);
    expect(done).toBe(true);
  });
});

describe("pieceForCursor", () => {
  it("returns the hand entry at the current index", () => {
    const cursor: PlacementCursor = {
      slot: 0,
      x: 0,
      y: 0,
      rot: 0,
      handIdx: 2,
      hand: ["plank", "block", "saw", "spike", "ice"] as PieceId[],
      confirmed: false,
      lastPlacedUid: null,
    };
    expect(pieceForCursor(cursor)).toBe("saw");
  });
});
