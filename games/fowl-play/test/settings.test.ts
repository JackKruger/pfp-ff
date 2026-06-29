import { describe, expect, it } from "vitest";
import type { LaunchContext } from "@pfp/sdk";
import { advance, createGame } from "../src/game.js";
import { matchIsOver } from "../src/phases/score.js";
import { beginPlacement } from "../src/phases/placement.js";
import {
  HAND_SIZE,
  LOOK_AROUND_MS,
  RACE_COUNTDOWN_MS,
  SCORE_MS,
  WIN_SCORE,
} from "../src/constants.js";
import { makeFrame, type PlayerFrame } from "../src/types.js";

function launch(settings: Record<string, unknown> = {}, slots = 2): LaunchContext {
  return {
    sessionId: "test",
    sdkVersion: "1.0.0",
    players: Array.from({ length: slots }, (_, i) => ({
      slot: i,
      profileId: null,
      displayName: `P${i + 1}`,
      color: "#ffffff",
      gamepadIndex: i,
    })),
    settings,
  };
}

describe("launch.settings → state.config", () => {
  it("falls back to constants when settings is empty", () => {
    const state = createGame(launch());
    expect(state.config.winScore).toBe(WIN_SCORE);
    expect(state.config.handSize).toBe(HAND_SIZE);
  });

  it("ignores malformed values", () => {
    const state = createGame(launch({ winScore: "not-a-number", handSize: -1 }));
    expect(state.config.winScore).toBe(WIN_SCORE);
    expect(state.config.handSize).toBe(HAND_SIZE);
  });

  it("accepts numeric strings (shell sends choice values as strings)", () => {
    const state = createGame(launch({ winScore: "5", handSize: 3 }));
    expect(state.config.winScore).toBe(5);
    expect(state.config.handSize).toBe(3);
  });

  it("matchIsOver respects the configured winScore", () => {
    const state = createGame(launch({ winScore: "5" }));
    state.players[0].score.finalScore = 4;
    expect(matchIsOver(state)).toBe(false);
    state.players[0].score.finalScore = 5;
    expect(matchIsOver(state)).toBe(true);
  });

  it("beginPlacement uses the configured handSize", () => {
    const state = createGame(launch({ handSize: 3 }));
    beginPlacement(state, 42);
    for (const cursor of state.cursors) expect(cursor.hand.length).toBe(3);
  });

  // Regression: hasClearWinner used to compare to the WIN_SCORE constant
  // instead of state.config.winScore, so custom winScores below the default
  // never ended the match (matchIsOver true, hasClearWinner false).
  it("hasClearWinner respects state.config.winScore so the match actually ends", () => {
    const state = createGame(launch({ winScore: "5" }, 2));
    const pump = (frame?: Partial<PlayerFrame>): PlayerFrame[] =>
      state.players.map((p) => ({ ...makeFrame(p.slot), ...(frame ?? {}) }));

    // Skip levelSelect → intro → placement → race → score → final.
    advance(state, pump({ confirmDown: true }), 16);
    advance(state, pump(), LOOK_AROUND_MS + 1);
    state.players[0].score.finalScore = 5; // already past the configured threshold
    state.players[1].score.finalScore = 0;
    advance(state, pump({ startDown: true }), 16);
    advance(state, pump(), RACE_COUNTDOWN_MS + 1);
    state.actors[0].x = state.arena.goal.x + 8;
    state.actors[0].y = state.arena.goal.y + 8;
    state.actors[1].y = state.arena.killLineY + 100;
    advance(state, pump(), 16);
    expect(state.phase).toBe("score");
    advance(state, pump(), SCORE_MS + 16);
    expect(state.phase).toBe("final");
  });
});
