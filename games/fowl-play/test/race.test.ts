import { describe, expect, it } from "vitest";
import {
  RACE_COUNTDOWN_MS,
  RACE_MAX_MS,
  SCORE_COIN,
  SCORE_DIAMOND,
  SCORE_FINISH,
  SCORE_LONE_SURVIVOR,
  SCORE_TRAP_KILL,
} from "../src/constants.js";
import {
  beginRace,
  countdownRemainingMs,
  finalizeRound,
  raceIsCountdown,
  tickRace,
} from "../src/phases/race.js";
import { makePlaced } from "../src/pieces/registry.js";
import {
  makeEmptyPlayerScore,
  makeFrame,
  type Arena,
  type GameState,
  type PlacedPiece,
  type Player,
  type PlayerFrame,
} from "../src/types.js";

const FAR_BOUNDS = { x: -1000, y: -1000, w: 4000, h: 4000 };

const TEST_ARENA: Arena = {
  id: "test",
  name: "Test",
  bounds: FAR_BOUNDS,
  killLineY: 600,
  start: { x: 100, y: 200 },
  goal: { x: 800, y: 180, w: 64, h: 64 },
  solids: [{ x: 0, y: 240, w: 2000, h: 80 }],
  scorers: [],
  noGoZones: [],
};

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

function makeState(players: Player[], pieces: PlacedPiece[] = []): GameState {
  return {
    phase: "race",
    phaseTimer: 0,
    round: 1,
    arena: TEST_ARENA,
    players,
    pieces,
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
    nextUid: 100,
    startedAt: 0,
    showLookAroundHint: false,
  };
}

function pumpFrames(state: GameState, frame?: Partial<PlayerFrame>): PlayerFrame[] {
  return state.players.map((p) => ({ ...makeFrame(p.slot), ...(frame ?? {}) }));
}

describe("beginRace", () => {
  it("spawns one actor per active player at the start position", () => {
    const state = makeState([makePlayer(0), makePlayer(1)]);
    beginRace(state);
    expect(state.actors.length).toBe(2);
    for (const actor of state.actors) {
      expect(actor.alive).toBe(true);
      expect(actor.finished).toBe(false);
      expect(actor.x).toBeGreaterThan(TEST_ARENA.start.x - 32);
      expect(actor.x).toBeLessThan(TEST_ARENA.start.x + 32);
    }
  });

  it("skips inactive players", () => {
    const players = [makePlayer(0), makePlayer(1)];
    players[0].active = false;
    const state = makeState(players);
    beginRace(state);
    expect(state.actors.length).toBe(1);
    expect(state.actors[0].slot).toBe(1);
  });

  it("populates runtime for mover pieces", () => {
    const pieces = [
      makePlaced(1, "crusher", 200, 100, 0, 0),
      makePlaced(2, "plank", 300, 100, 0, 0),
      makePlaced(3, "mace", 400, 100, 0, 0),
    ];
    const state = makeState([makePlayer(0)], pieces);
    beginRace(state);
    expect(state.runtime.has(1)).toBe(true);
    expect(state.runtime.has(2)).toBe(false);
    expect(state.runtime.has(3)).toBe(true);
  });

  it("sets phaseTimer to countdown + race window", () => {
    const state = makeState([makePlayer(0)]);
    beginRace(state);
    expect(state.phaseTimer).toBe(RACE_COUNTDOWN_MS + RACE_MAX_MS);
  });
});

describe("countdown", () => {
  it("raceIsCountdown is true at race start", () => {
    const state = makeState([makePlayer(0)]);
    beginRace(state);
    expect(raceIsCountdown(state)).toBe(true);
    expect(countdownRemainingMs(state)).toBe(RACE_COUNTDOWN_MS);
  });

  it("becomes false after the countdown elapses", () => {
    const state = makeState([makePlayer(0)]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    expect(raceIsCountdown(state)).toBe(false);
    expect(countdownRemainingMs(state)).toBe(0);
  });

  it("physics is frozen during the countdown", () => {
    const state = makeState([makePlayer(0)]);
    beginRace(state);
    const startY = state.actors[0].y;
    tickRace(state, pumpFrames(state), 100); // still in countdown
    expect(state.actors[0].y).toBe(startY);
  });
});

describe("goal contact", () => {
  it("marks actor finished and awards SCORE_FINISH", () => {
    const players = [makePlayer(0)];
    const state = makeState(players);
    beginRace(state);
    // Skip countdown.
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    // Teleport into the goal.
    state.actors[0].x = TEST_ARENA.goal.x + 8;
    state.actors[0].y = TEST_ARENA.goal.y + 8;
    tickRace(state, pumpFrames(state), 16);
    expect(state.actors[0].finished).toBe(true);
    expect(state.actors[0].finishedAt).toBeGreaterThan(0);
    expect(players[0].score.finishes).toBe(1);
    expect(players[0].score.finalScore).toBe(SCORE_FINISH);
  });
});

describe("kill line", () => {
  it("kills actors that fall below killLineY", () => {
    const players = [makePlayer(0)];
    const state = makeState(players);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    state.actors[0].y = TEST_ARENA.killLineY + 50;
    tickRace(state, pumpFrames(state), 16);
    expect(state.actors[0].alive).toBe(false);
    expect(state.actors[0].killedBy).toBe(-1);
    expect(players[0].score.deaths).toBe(1);
  });
});

describe("hazard contact", () => {
  it("spike kills only from above (vy > 0)", () => {
    const players = [makePlayer(0)];
    const spike = makePlaced(1, "spike", 200, 100, 0, 1);
    const state = makeState(players, [spike]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    // Position actor INSIDE the spike but moving upward — should NOT kill.
    state.actors[0].x = 210;
    state.actors[0].y = 102;
    state.actors[0].vy = -100;
    tickRace(state, pumpFrames(state), 16);
    expect(state.actors[0].alive).toBe(true);
  });

  it("spike kills when stomped from above", () => {
    const players = [makePlayer(0), makePlayer(1)];
    const spike = makePlaced(1, "spike", 200, 100, 0, 1); // placed by P2
    const state = makeState(players, [spike]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    // Drop from above onto spike.
    state.actors[0].x = 210;
    state.actors[0].y = 76; // just above spike top
    state.actors[0].vy = 200;
    tickRace(state, pumpFrames(state), 16);
    expect(state.actors[0].alive).toBe(false);
    expect(state.actors[0].killedBy).toBe(1);
    expect(players[1].score.killsCaused).toBe(1);
    expect(players[1].score.finalScore).toBe(SCORE_TRAP_KILL);
  });

  it("saw kills from any direction (always lethal)", () => {
    const players = [makePlayer(0), makePlayer(1)];
    const saw = makePlaced(1, "saw", 200, 100, 0, 1);
    const state = makeState(players, [saw]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    state.actors[0].x = 210;
    state.actors[0].y = 110;
    state.actors[0].vy = -100; // moving up
    tickRace(state, pumpFrames(state), 16);
    expect(state.actors[0].alive).toBe(false);
    expect(state.actors[0].killedBy).toBe(1);
  });

  it("own trap kills don't credit kills but do increment selfKills", () => {
    const players = [makePlayer(0)];
    const saw = makePlaced(1, "saw", 200, 100, 0, 0); // own piece
    const state = makeState(players, [saw]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    state.actors[0].x = 210;
    state.actors[0].y = 110;
    tickRace(state, pumpFrames(state), 16);
    expect(state.actors[0].alive).toBe(false);
    expect(players[0].score.selfKills).toBe(1);
    expect(players[0].score.killsCaused).toBe(0);
  });
});

describe("scorers", () => {
  it("coin pickup awards SCORE_COIN and removes the coin", () => {
    const players = [makePlayer(0)];
    const coin = makePlaced(1, "coin", 200, 100, 0, -1);
    const state = makeState(players, [coin]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    state.actors[0].x = 200;
    state.actors[0].y = 100;
    tickRace(state, pumpFrames(state), 16);
    expect(players[0].score.coinsCollected).toBe(1);
    expect(players[0].score.finalScore).toBe(SCORE_COIN);
    expect(state.pieces.some((p) => p.pieceId === "coin")).toBe(false);
  });

  it("diamond pickup awards SCORE_DIAMOND and removes the diamond", () => {
    const players = [makePlayer(0)];
    const dia = makePlaced(1, "diamond", 200, 100, 0, -1);
    const state = makeState(players, [dia]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    state.actors[0].x = 200;
    state.actors[0].y = 100;
    tickRace(state, pumpFrames(state), 16);
    expect(players[0].score.diamondsCollected).toBe(1);
    expect(players[0].score.finalScore).toBe(SCORE_DIAMOND);
  });
});

describe("bouncy + trampoline", () => {
  it("bouncy sets a negative vy when actor lands on it", () => {
    const players = [makePlayer(0)];
    const bouncy = makePlaced(1, "bouncy", 200, 100, 0, 1);
    const state = makeState(players, [bouncy]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    // Drop onto the pad from just above — bouncy is solid, so landing rests
    // the actor on top, which is what triggers the bounce.
    state.actors[0].x = 210;
    state.actors[0].y = 60;
    state.actors[0].vy = 200;
    let minVy = 0;
    for (let i = 0; i < 20; i++) {
      tickRace(state, pumpFrames(state), 16);
      minVy = Math.min(minVy, state.actors[0].vy);
    }
    expect(minVy).toBeLessThanOrEqual(-300);
  });

  it("trampoline launches harder than bouncy", () => {
    const players = [makePlayer(0)];
    const tramp = makePlaced(1, "trampoline", 200, 100, 0, 1);
    const state = makeState(players, [tramp]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    state.actors[0].x = 210;
    state.actors[0].y = 60;
    state.actors[0].vy = 200;
    let minVy = 0;
    for (let i = 0; i < 20; i++) {
      tickRace(state, pumpFrames(state), 16);
      minVy = Math.min(minVy, state.actors[0].vy);
    }
    expect(minVy).toBeLessThanOrEqual(-500);
  });

  it("side contact with a pad does not launch the actor", () => {
    // Regression: walking into the side of a bouncy/trampoline used to fling
    // the player upward, because any inflated-probe overlap with vy >= 0
    // triggered the bounce.
    const players = [makePlayer(0)];
    // Pad sits on the test floor (floor top y=240): pad top at 224.
    const tramp = makePlaced(1, "trampoline", 300, 224, 0, 1);
    const state = makeState(players, [tramp]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    // Stand on the floor left of the pad and walk right into its side.
    state.actors[0].x = 250;
    state.actors[0].y = 240 - 24;
    state.actors[0].vy = 0;
    let launched = false;
    for (let i = 0; i < 60; i++) {
      tickRace(state, pumpFrames(state, { moveX: 1 }), 16);
      if (state.actors[0].vy < -100) launched = true;
    }
    expect(launched).toBe(false);
  });

  it("bounces an actor that falls naturally and rests on the pad", () => {
    // Regression: a solid pad rests the actor a hair above its surface after
    // collision resolution, so a strict overlap test would miss the contact and
    // never bounce. Drop the actor from above and let physics land it.
    const players = [makePlayer(0)];
    const bouncy = makePlaced(1, "bouncy", 200, 224, 0, 1); // sits on the floor
    const state = makeState(players, [bouncy]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    state.actors[0].x = 205;
    state.actors[0].y = 150;
    state.actors[0].vx = 0;
    state.actors[0].vy = 0;
    state.actors[0].contact = "none";

    let bounced = false;
    for (let i = 0; i < 120; i++) {
      tickRace(state, pumpFrames(state), 16);
      if (state.actors[0].vy <= -300) bounced = true;
    }
    expect(bounced).toBe(true);
  });
});

describe("conveyor", () => {
  it("carries a standing actor along the belt", () => {
    const players = [makePlayer(0)];
    // Conveyor resting on the test floor (floor top y=240): top at 224.
    const belt = makePlaced(1, "conveyor", 300, 224, 0, 1);
    const state = makeState(players, [belt]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    state.actors[0].x = 320;
    state.actors[0].y = 224 - 24;
    state.actors[0].vx = 0;
    state.actors[0].vy = 0;
    const startX = state.actors[0].x;
    for (let i = 0; i < 40; i++) tickRace(state, pumpFrames(state), 16);
    // ~0.64s on a 110 px/s belt should carry the actor a meaningful distance.
    expect(state.actors[0].x).toBeGreaterThan(startX + 40);
  });
});

describe("spike lethality", () => {
  it("kills an actor standing in it (walking through floor spikes)", () => {
    const players = [makePlayer(0), makePlayer(1)];
    const spike = makePlaced(1, "spike", 300, 224, 0, 1); // on the floor
    const state = makeState(players, [spike]);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    // Standing on the floor, overlapping the spike strip, vy settles to 0.
    state.actors[0].x = 310;
    state.actors[0].y = 240 - 24;
    state.actors[0].vy = 0;
    tickRace(state, pumpFrames(state), 16);
    expect(state.actors[0].alive).toBe(false);
    expect(state.actors[0].killedByCause).toBe("spike");
  });
});

describe("jump sound", () => {
  it("emits 'jump' when a grounded actor jumps", () => {
    const players = [makePlayer(0)];
    const state = makeState(players);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    // Let the actor settle onto the floor.
    for (let i = 0; i < 30; i++) tickRace(state, pumpFrames(state), 16);
    state.soundEvents.length = 0;
    tickRace(state, pumpFrames(state, { jumpDown: true, jumpHeld: true }), 16);
    expect(state.soundEvents).toContain("jump");
  });

  it("does not emit 'jump' for a hard landing", () => {
    const players = [makePlayer(0)];
    const state = makeState(players);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    // Drop fast onto the floor (top at y=240) — the abrupt vy 900 → 0 swing
    // must not read as a jump.
    state.actors[0].x = 500;
    state.actors[0].y = 240 - 24 - 40;
    state.actors[0].vy = 900;
    state.soundEvents.length = 0;
    for (let i = 0; i < 10; i++) tickRace(state, pumpFrames(state), 16);
    expect(state.soundEvents).not.toContain("jump");
  });
});

describe("round end conditions", () => {
  it("returns all_finished once every actor crosses the goal", () => {
    const players = [makePlayer(0), makePlayer(1)];
    const state = makeState(players);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    for (const a of state.actors) {
      a.x = TEST_ARENA.goal.x + 8;
      a.y = TEST_ARENA.goal.y + 8;
    }
    const outcome = tickRace(state, pumpFrames(state), 16);
    expect(outcome).toBe("all_finished");
  });

  it("returns all_dead if every actor dies before finishing", () => {
    const players = [makePlayer(0), makePlayer(1)];
    const state = makeState(players);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    for (const a of state.actors) a.y = TEST_ARENA.killLineY + 100;
    const outcome = tickRace(state, pumpFrames(state), 16);
    expect(outcome).toBe("all_dead");
  });

  it("returns timeout if the 60s timer runs out with alive non-finished actors", () => {
    const players = [makePlayer(0)];
    const state = makeState(players);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    state.phaseTimer = 0;
    const outcome = tickRace(state, pumpFrames(state), 16);
    expect(outcome).toBe("timeout");
  });

  it("returns null while at least one actor is still racing", () => {
    const players = [makePlayer(0), makePlayer(1)];
    const state = makeState(players);
    beginRace(state);
    tickRace(state, pumpFrames(state), RACE_COUNTDOWN_MS + 1);
    expect(tickRace(state, pumpFrames(state), 16)).toBeNull();
  });
});

describe("finalizeRound", () => {
  it("records per-slot deltas from finishes and coins", () => {
    const players = [makePlayer(0), makePlayer(1)];
    const state = makeState(players);
    beginRace(state);
    state.actors[0].finished = true;
    state.actors[0].roundCoins = 2;
    state.actors[1].finished = true;
    state.actors[1].roundCoins = 0;
    const log = finalizeRound(state, "all_finished");
    expect(log.delta.get(0)).toBe(SCORE_FINISH + 2 * SCORE_COIN);
    expect(log.delta.get(1)).toBe(SCORE_FINISH);
    expect(log.outcome).toBe("all_finished");
    expect(log.arenaId).toBe(TEST_ARENA.id);
  });

  it("awards lone-survivor bonus only when exactly one finishes", () => {
    const players = [makePlayer(0), makePlayer(1)];
    const state = makeState(players);
    beginRace(state);
    state.actors[0].finished = true;
    state.actors[1].alive = false;
    state.actors[1].killedBy = -1;
    const log = finalizeRound(state, "all_finished");
    expect(log.delta.get(0)).toBe(SCORE_FINISH + SCORE_LONE_SURVIVOR);
    expect(players[0].score.loneSurvivor).toBe(1);
  });

  it("credits trap kill to the trap owner in the round delta", () => {
    const players = [makePlayer(0), makePlayer(1)];
    const state = makeState(players);
    beginRace(state);
    // Kill actor 0 with a piece placed by slot 1.
    state.actors[0].alive = false;
    state.actors[0].killedBy = 1;
    const log = finalizeRound(state, "all_dead");
    expect(log.delta.get(1)).toBe(SCORE_TRAP_KILL);
  });

  it("does not award lone-survivor with a sole player game", () => {
    const players = [makePlayer(0)];
    const state = makeState(players);
    beginRace(state);
    state.actors[0].finished = true;
    finalizeRound(state, "all_finished");
    expect(players[0].score.loneSurvivor).toBe(0);
  });

  it("crowns a round winner when one slot has a strict max delta", () => {
    const players = [makePlayer(0), makePlayer(1)];
    const state = makeState(players);
    beginRace(state);
    state.actors[0].finished = true;
    state.actors[0].roundCoins = 3;
    state.actors[1].finished = true;
    finalizeRound(state, "all_finished");
    expect(players[0].score.roundsWon).toBe(1);
    expect(players[1].score.roundsWon).toBe(0);
  });

  it("restores mover pieces to their placed positions", () => {
    const players = [makePlayer(0)];
    const mace = makePlaced(1, "mace", 400, 120, 0, 0);
    const state = makeState(players, [mace]);
    beginRace(state);
    // Simulate the swing having moved the piece during the race.
    mace.x = 470;
    mace.y = 190;
    finalizeRound(state, "timeout");
    expect(mace.x).toBe(400);
    expect(mace.y).toBe(120);
  });

  it("doesn't crown a round winner if the top delta ties", () => {
    const players = [makePlayer(0), makePlayer(1)];
    const state = makeState(players);
    beginRace(state);
    state.actors[0].finished = true;
    state.actors[1].finished = true;
    finalizeRound(state, "all_finished");
    expect(players[0].score.roundsWon).toBe(0);
    expect(players[1].score.roundsWon).toBe(0);
  });
});
