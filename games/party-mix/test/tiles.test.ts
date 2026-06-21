import { describe, expect, it } from "vitest";
import type { LaunchContext } from "@pfp/sdk";
import { advance, createGame, STAR_COST, type GameState, type InputFrame } from "../src/game.js";

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

function frame(n: number, aIdx = -1): InputFrame {
  return {
    inputs: Array.from({ length: n }, (_, i) => ({ a: i === aIdx, b: false, dx: 0, dy: 0 })),
    anyStart: false,
  };
}

/** Drives the active player's turn so they land exactly `dist` tiles ahead. */
function takeTurn(state: GameState, n: number, active: number, dist: number): void {
  state.phase = "turn";
  state.activeIdx = active;
  // turn -> rolling
  advance(state, 16, frame(n)); // release
  advance(state, 16, frame(n, active)); // press A to roll
  // rolling -> moving, with a forced die value
  advance(state, 16, frame(n)); // release (16ms < spin interval, die unchanged)
  state.die = dist;
  advance(state, 0, frame(n, active)); // press A to lock the die
  expect(state.phase).toBe("moving");
  // run all the hops + the resolve window
  let guard = 0;
  while (state.phase === "moving" && guard++ < 50) advance(state, 200, frame(n));
}

describe("star tile", () => {
  it("buys a star when affordable and relocates the star", () => {
    const state = createGame(ctx(2));
    const p = state.players[0]!;
    const target = state.starTile;
    p.tile = (target - 1 + state.board.tiles.length) % state.board.tiles.length;
    p.coins = STAR_COST + 5;

    takeTurn(state, 2, 0, 1);

    expect(p.stars).toBe(1);
    expect(p.coins).toBe(5);
    expect(state.starTile).not.toBe(target); // it hopped elsewhere
  });

  it("does not buy when the player can't afford it", () => {
    const state = createGame(ctx(2));
    const p = state.players[0]!;
    const target = state.starTile;
    p.tile = (target - 1 + state.board.tiles.length) % state.board.tiles.length;
    p.coins = STAR_COST - 1;

    takeTurn(state, 2, 0, 1);

    expect(p.stars).toBe(0);
    expect(p.coins).toBe(STAR_COST - 1);
    expect(state.starTile).toBe(target); // unchanged
  });
});
