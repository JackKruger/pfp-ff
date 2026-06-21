import { describe, expect, it } from "vitest";
import type { LaunchContext } from "@pfp/sdk";
import { createBoard, step } from "../src/board.js";
import { advance, buildStandings, createGame, TOTAL_ROUNDS, type InputFrame } from "../src/game.js";

function ctx(n: number): LaunchContext {
  return {
    sessionId: "s",
    sdkVersion: "1.0.0",
    settings: {},
    players: Array.from({ length: n }, (_, i) => ({
      slot: i,
      profileId: `p${i}`,
      displayName: `P${i + 1}`,
      color: "#fff",
      gamepadIndex: i,
    })),
  };
}

function frame(n: number, aIdx = -1, anyStart = false): InputFrame {
  return {
    inputs: Array.from({ length: n }, (_, i) => ({ a: i === aIdx, b: false, dx: 0, dy: 0 })),
    anyStart,
  };
}

describe("board", () => {
  it("forms a closed loop with a start tile at index 0", () => {
    const board = createBoard();
    expect(board.tiles.length).toBeGreaterThan(0);
    expect(board.tiles[0]!.kind).toBe("start");
  });

  it("steps wrap around the loop", () => {
    const board = createBoard();
    const n = board.tiles.length;
    expect(step(board, n - 1, 1)).toBe(0);
    expect(step(board, 0, n)).toBe(0);
  });
});

describe("standings", () => {
  it("ranks by stars then coins, sharing ranks on ties", () => {
    const state = createGame(ctx(4));
    state.players[0]!.stars = 1;
    state.players[0]!.coins = 5;
    state.players[1]!.stars = 1;
    state.players[1]!.coins = 5; // tie with p0
    state.players[2]!.stars = 0;
    state.players[2]!.coins = 30;
    state.players[3]!.stars = 0;
    state.players[3]!.coins = 10;

    const s = buildStandings(state);
    const bySlot = Object.fromEntries(s.map((x) => [x.slot, x.rank]));
    expect(bySlot[0]).toBe(1);
    expect(bySlot[1]).toBe(1); // shared rank
    expect(bySlot[2]).toBe(3); // tie consumed rank 2
    expect(bySlot[3]).toBe(4);
  });
});

describe("turn flow", () => {
  it("an A press starts the match from the intro", () => {
    const state = createGame(ctx(2));
    expect(state.phase).toBe("intro");
    advance(state, 16, frame(2, 0));
    expect(state.phase).toBe("turn");
  });

  it("reaches results after all rounds and reports standings once", () => {
    const state = createGame(ctx(2));
    let standings = advance(state, 16, frame(2, 0)); // intro -> turn
    expect(standings).toBeNull();

    // Drive the state machine deterministically to completion. A presses are
    // edge-triggered, so each press is preceded by a release frame.
    const tapA = (idx: number) => {
      advance(state, 16, frame(2)); // release
      advance(state, 16, frame(2, idx)); // press edge
    };
    let guard = 0;
    while (state.phase !== "results" && guard++ < 5000) {
      const active = state.activeIdx;
      switch (state.phase) {
        case "turn":
          tapA(active); // roll
          break;
        case "rolling":
          tapA(active); // lock the die
          break;
        case "roundEnd":
          tapA(0); // continue
          break;
        default:
          // moving / resolve: advance time, no input edge
          advance(state, 200, frame(2));
          break;
      }
    }
    expect(state.phase).toBe("results");
    expect(state.round).toBe(TOTAL_ROUNDS);

    standings = buildStandings(state);
    expect(standings).toHaveLength(2);
    expect(standings[0]!.stats).toHaveProperty("coins");
  });
});
