import { describe, expect, it } from "vitest";
import type { LaunchContext } from "@pfp/sdk";
import {
  RACE_COUNTDOWN_MS,
  RACE_MAX_MS,
  SCORE_MS,
  LOOK_AROUND_MS,
} from "../src/constants.js";
import { advance, createGame } from "../src/game.js";
import { beginRace, tickRace } from "../src/phases/race.js";
import { makePlaced } from "../src/pieces/registry.js";
import { makeFrame, type PlayerFrame } from "../src/types.js";
import { buildPlayer, buildTestState } from "./_helpers.js";

function pump(state: { players: { slot: number }[] }, frame?: Partial<PlayerFrame>): PlayerFrame[] {
  return state.players.map((p) => ({ ...makeFrame(p.slot), ...(frame ?? {}) }));
}

function launch(slots = 2): LaunchContext {
  return {
    sessionId: "s",
    sdkVersion: "1.0.0",
    players: Array.from({ length: slots }, (_, i) => ({
      slot: i,
      profileId: null,
      displayName: `P${i + 1}`,
      color: "#ffffff",
      gamepadIndex: i,
    })),
    settings: {},
  };
}

describe("scoring events emit sound events", () => {
  it("coin pickup emits 'coin'", () => {
    const state = buildTestState({
      players: [buildPlayer(0)],
      phase: "race",
      pieces: [makePlaced(1, "coin", 0, 0, 0, -1)],
    });
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].x = 0;
    state.actors[0].y = 0;
    tickRace(state, pump(state), 16);
    expect(state.soundEvents).toContain("coin");
  });

  it("diamond pickup emits 'diamond'", () => {
    const state = buildTestState({
      players: [buildPlayer(0)],
      phase: "race",
      pieces: [makePlaced(1, "diamond", 0, 0, 0, -1)],
    });
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].x = 0;
    state.actors[0].y = 0;
    tickRace(state, pump(state), 16);
    expect(state.soundEvents).toContain("diamond");
  });

  it("death emits 'death'", () => {
    const state = buildTestState({
      players: [buildPlayer(0)],
      phase: "race",
    });
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].y = state.arena.killLineY + 100;
    tickRace(state, pump(state), 16);
    expect(state.soundEvents).toContain("death");
  });

  it("trap kill emits both 'death' and 'kill'", () => {
    const state = buildTestState({
      players: [buildPlayer(0), buildPlayer(1)],
      phase: "race",
      pieces: [makePlaced(1, "saw", 0, 0, 0, 1)],
    });
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].x = 0;
    state.actors[0].y = 0;
    tickRace(state, pump(state), 16);
    expect(state.soundEvents).toContain("death");
    expect(state.soundEvents).toContain("kill");
  });

  it("finishing emits 'finish'", () => {
    const state = buildTestState({
      players: [buildPlayer(0)],
      phase: "race",
    });
    state.arena.goal = { x: 0, y: 0, w: 32, h: 32 };
    beginRace(state);
    state.phaseTimer = RACE_MAX_MS;
    state.actors[0].x = 8;
    state.actors[0].y = 8;
    tickRace(state, pump(state), 16);
    expect(state.soundEvents).toContain("finish");
  });
});

describe("FSM-driven sound events", () => {
  it("emits a 'countdownTick' as the countdown clicks down a second", () => {
    const state = createGame(launch(1));
    // Skip the intro phase.
    advance(state, pump(state), LOOK_AROUND_MS + 1);
    // Start the race.
    advance(state, pump(state, { startDown: true }), 16);
    expect(state.phase).toBe("race");
    state.soundEvents.length = 0;
    // Tick through a 1-second window — should fire at least one countdownTick.
    advance(state, pump(state), 1100);
    expect(state.soundEvents).toContain("countdownTick");
  });

  it("emits 'go' on the last edge of the countdown", () => {
    const state = createGame(launch(1));
    advance(state, pump(state), LOOK_AROUND_MS + 1);
    advance(state, pump(state, { startDown: true }), 16);
    state.soundEvents.length = 0;
    advance(state, pump(state), RACE_COUNTDOWN_MS);
    expect(state.soundEvents).toContain("go");
  });

  it("emits 'win' when score → final fires", () => {
    const state = createGame(launch(2));
    advance(state, pump(state), LOOK_AROUND_MS + 1);
    state.players[0].score.finalScore = state.config.winScore;
    state.players[1].score.finalScore = 0;
    advance(state, pump(state, { startDown: true }), 16);
    advance(state, pump(state), RACE_COUNTDOWN_MS + 1);
    state.actors[0].x = state.arena.goal.x + 8;
    state.actors[0].y = state.arena.goal.y + 8;
    state.actors[1].y = state.arena.killLineY + 100;
    advance(state, pump(state), 16);
    state.soundEvents.length = 0;
    advance(state, pump(state), SCORE_MS + 16);
    expect(state.soundEvents).toContain("win");
  });
});
