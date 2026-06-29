import { describe, expect, it } from "vitest";
import type { LaunchContext } from "@pfp/sdk";
import { ARENAS, pickArena } from "../src/arenas/index.js";
import {
  FINAL_HOLD_MS,
  LOOK_AROUND_MS,
  PLACEMENT_MS,
  RACE_COUNTDOWN_MS,
  RACE_MAX_MS,
  ROUND_LOOK_MS,
  SCORE_MS,
  SUDDEN_DEATH_LOOK_MS,
  WIN_SCORE,
} from "../src/constants.js";
import { advance, createGame } from "../src/game.js";
import { makePlaced } from "../src/pieces/registry.js";
import { makeFrame, type GameState, type PlayerFrame } from "../src/types.js";

function launch(slots = 2): LaunchContext {
  return {
    sessionId: "test-session",
    sdkVersion: "1.0.0",
    players: Array.from({ length: slots }, (_, i) => ({
      slot: i,
      profileId: null,
      displayName: `P${i + 1}`,
      color: "#ef4444",
      gamepadIndex: i,
    })),
    settings: {},
  };
}

function pump(state: GameState, frame?: Partial<PlayerFrame>): PlayerFrame[] {
  return state.players.map((p) => ({ ...makeFrame(p.slot), ...(frame ?? {}) }));
}

/** Take a freshly-created game past the pre-match level picker into intro. */
function confirmLevel(state: GameState): void {
  advance(state, pump(state, { confirmDown: true }), 16);
}

describe("createGame", () => {
  it("starts in the levelSelect phase with the look-around hint pending", () => {
    const state = createGame(launch(2));
    expect(state.phase).toBe("levelSelect");
    expect(state.showLookAroundHint).toBe(true);
    expect(state.round).toBe(1);
    // Scorers are not seeded until a level is confirmed.
    expect(state.pieces.length).toBe(0);
  });

  it("confirming the level → intro, seeding arena scorers with placedBy = -1", () => {
    const state = createGame(launch(2));
    confirmLevel(state);
    expect(state.phase).toBe("intro");
    expect(state.phaseTimer).toBe(LOOK_AROUND_MS);
    expect(state.pieces.length).toBeGreaterThan(0);
    for (const p of state.pieces) {
      expect(p.placedBy).toBe(-1);
      expect(["coin", "diamond"]).toContain(p.pieceId);
    }
  });

  it("creates one Player entry per slot with a zero starting score", () => {
    const state = createGame(launch(4));
    expect(state.players.length).toBe(4);
    for (const p of state.players) {
      expect(p.score.finalScore).toBe(0);
      expect(p.score.deaths).toBe(0);
      expect(p.score.finishes).toBe(0);
    }
  });

  it("picks the first arena for round 1", () => {
    const state = createGame(launch(2));
    expect(state.arena.id).toBe(ARENAS[0].id);
  });
});

describe("advance FSM", () => {
  it("levelSelect → intro when a player confirms", () => {
    const state = createGame(launch(2));
    advance(state, pump(state, { confirmDown: true }), 16);
    expect(state.phase).toBe("intro");
    expect(state.phaseTimer).toBe(LOOK_AROUND_MS);
  });

  it("levelSelect cycles the highlighted arena with left/right", () => {
    const state = createGame(launch(1));
    expect(state.levelSelectIdx).toBe(0);
    advance(state, pump(state, { nextDown: true }), 16);
    expect(state.levelSelectIdx).toBe(1);
    expect(state.arena.id).toBe(ARENAS[1].id);
    expect(state.phase).toBe("levelSelect"); // not confirmed yet
  });

  it("intro → placement after LOOK_AROUND_MS", () => {
    const state = createGame(launch(2));
    confirmLevel(state);
    advance(state, pump(state), LOOK_AROUND_MS + 1);
    expect(state.phase).toBe("placement");
    expect(state.phaseTimer).toBe(PLACEMENT_MS);
    expect(state.cursors.length).toBe(2);
    expect(state.showLookAroundHint).toBe(false);
  });

  it("placement → race when all players ready up", () => {
    const state = createGame(launch(2));
    confirmLevel(state);
    advance(state, pump(state), LOOK_AROUND_MS + 1);
    advance(state, pump(state, { startDown: true }), 16);
    expect(state.phase).toBe("race");
    expect(state.phaseTimer).toBe(RACE_COUNTDOWN_MS + RACE_MAX_MS);
    expect(state.actors.length).toBe(2);
  });

  it("placement → race when the timer expires", () => {
    const state = createGame(launch(2));
    confirmLevel(state);
    advance(state, pump(state), LOOK_AROUND_MS + 1);
    advance(state, pump(state), PLACEMENT_MS + 16);
    expect(state.phase).toBe("race");
  });

  it("race → score when all actors are gone (all_dead path)", () => {
    const state = createGame(launch(1));
    confirmLevel(state);
    advance(state, pump(state), LOOK_AROUND_MS + 1);
    advance(state, pump(state, { startDown: true }), 16);
    // Skip countdown.
    advance(state, pump(state), RACE_COUNTDOWN_MS + 1);
    // Drive actor below the kill line.
    state.actors[0].y = state.arena.killLineY + 100;
    advance(state, pump(state), 16);
    expect(state.phase).toBe("score");
    expect(state.lastRound).not.toBeNull();
    expect(state.lastRound?.outcome).toBe("all_dead");
  });

  it("score → next round keeps the same arena and retains player pieces (UCH chaos)", () => {
    const state = createGame(launch(2));
    confirmLevel(state);
    advance(state, pump(state), LOOK_AROUND_MS + 1);
    advance(state, pump(state, { startDown: true }), 16);
    advance(state, pump(state), RACE_COUNTDOWN_MS + 1);
    for (const a of state.actors) {
      a.x = state.arena.goal.x + 8;
      a.y = state.arena.goal.y + 8;
    }
    advance(state, pump(state), 16);
    expect(state.phase).toBe("score");

    const arenaBefore = state.arena.id;
    // A player-placed piece from this round must survive into the next.
    state.pieces.push(makePlaced(state.nextUid++, "block", 100, 100, 0, 0));
    advance(state, pump(state), SCORE_MS + 16);

    expect(state.round).toBe(2);
    // Between rounds we now go through a short look-around intro before
    // returning to placement, so the next phase is "intro" not "placement".
    expect(state.phase).toBe("intro");
    expect(state.phaseTimer).toBe(ROUND_LOOK_MS);
    expect(state.suddenDeath).toBe(false);
    // Same map for the whole match.
    expect(state.arena.id).toBe(arenaBefore);
    // Player piece persists; the arena's scorers are respawned.
    expect(state.pieces.some((p) => p.placedBy === 0 && p.pieceId === "block")).toBe(true);
    expect(state.pieces.some((p) => p.placedBy === -1)).toBe(true);

    // …and once the round-look intro elapses, placement begins as before.
    advance(state, pump(state), ROUND_LOOK_MS + 1);
    expect(state.phase).toBe("placement");
  });

  it("score → final when a clear winner has WIN_SCORE", () => {
    const state = createGame(launch(2));
    confirmLevel(state);
    advance(state, pump(state), LOOK_AROUND_MS + 1);
    state.players[0].score.finalScore = WIN_SCORE;
    state.players[1].score.finalScore = 0;
    advance(state, pump(state, { startDown: true }), 16);
    advance(state, pump(state), RACE_COUNTDOWN_MS + 1);
    state.actors[0].x = state.arena.goal.x + 8;
    state.actors[0].y = state.arena.goal.y + 8;
    state.actors[1].y = state.arena.killLineY + 100;
    advance(state, pump(state), 16);
    expect(state.phase).toBe("score");
    advance(state, pump(state), SCORE_MS + 16);
    expect(state.phase).toBe("final");
    expect(state.phaseTimer).toBe(FINAL_HOLD_MS);
  });

  it("tied at WIN_SCORE enters sudden death and skips placement", () => {
    const state = createGame(launch(2));
    confirmLevel(state);
    advance(state, pump(state), LOOK_AROUND_MS + 1);
    state.players[0].score.finalScore = WIN_SCORE;
    state.players[1].score.finalScore = WIN_SCORE;
    advance(state, pump(state, { startDown: true }), 16);
    advance(state, pump(state), RACE_COUNTDOWN_MS + 1);
    state.actors[0].y = state.arena.killLineY + 100;
    state.actors[1].y = state.arena.killLineY + 100;
    advance(state, pump(state), 16);
    advance(state, pump(state), SCORE_MS + 16);
    // Tie at threshold → sudden-death intro, not placement.
    expect(state.suddenDeath).toBe(true);
    expect(state.phase).toBe("intro");
    expect(state.phaseTimer).toBe(SUDDEN_DEATH_LOOK_MS);
    // Once the look-around clears, we go straight to race (no placement).
    advance(state, pump(state), SUDDEN_DEATH_LOOK_MS + 1);
    expect(state.phase).toBe("race");
    // Actors were spawned without re-entering placement.
    expect(state.actors.length).toBe(state.players.length);
  });

  it("sudden death resolves to final when one player breaks the tie", () => {
    const state = createGame(launch(2));
    confirmLevel(state);
    advance(state, pump(state), LOOK_AROUND_MS + 1);
    state.players[0].score.finalScore = WIN_SCORE;
    state.players[1].score.finalScore = WIN_SCORE;
    // Run a round that ties to enter sudden death.
    advance(state, pump(state, { startDown: true }), 16);
    advance(state, pump(state), RACE_COUNTDOWN_MS + 1);
    state.actors[0].y = state.arena.killLineY + 100;
    state.actors[1].y = state.arena.killLineY + 100;
    advance(state, pump(state), 16);
    advance(state, pump(state), SCORE_MS + 16);
    expect(state.suddenDeath).toBe(true);
    // Walk into the SD race.
    advance(state, pump(state), SUDDEN_DEATH_LOOK_MS + 1);
    expect(state.phase).toBe("race");
    advance(state, pump(state), RACE_COUNTDOWN_MS + 1);
    // One player finishes; the other dies, breaking the tie.
    state.actors[0].x = state.arena.goal.x + 8;
    state.actors[0].y = state.arena.goal.y + 8;
    state.actors[1].y = state.arena.killLineY + 100;
    advance(state, pump(state), 16);
    expect(state.phase).toBe("score");
    advance(state, pump(state), SCORE_MS + 16);
    expect(state.phase).toBe("final");
  });

  it("final returns true once FINAL_HOLD_MS elapses past the grace window", () => {
    const state = createGame(launch(2));
    state.phase = "final";
    state.phaseTimer = FINAL_HOLD_MS;
    // First 1.5s is a grace window: confirm presses are ignored.
    expect(advance(state, pump(state, { confirmDown: true }), 100)).toBe(false);
    // Past the grace window, an A press skips out immediately.
    expect(advance(state, pump(state, { confirmDown: true }), 1600)).toBe(true);
  });

  it("final returns true after the full hold even without an input", () => {
    const state = createGame(launch(2));
    state.phase = "final";
    state.phaseTimer = FINAL_HOLD_MS;
    expect(advance(state, pump(state), FINAL_HOLD_MS - 100)).toBe(false);
    expect(advance(state, pump(state), 200)).toBe(true);
  });
});

describe("pickArena", () => {
  it("rotates through ARENAS in round order", () => {
    for (let i = 0; i < ARENAS.length; i++) {
      expect(pickArena(i + 1).id).toBe(ARENAS[i].id);
    }
    // Wraps around at the end of the catalog.
    expect(pickArena(ARENAS.length + 1).id).toBe(ARENAS[0].id);
  });
});
