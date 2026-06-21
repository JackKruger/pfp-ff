import { describe, expect, it } from "vitest";
import type { LaunchContext } from "@pfp/sdk";
import {
  advance,
  ALIEN_COLS,
  ALIEN_GAP_X,
  ALIEN_GAP_Y,
  ALIEN_GRID_START_X,
  ALIEN_GRID_START_Y,
  ALIEN_H,
  ALIEN_ROWS,
  ALIEN_SPEED_MAX,
  ALIEN_W,
  ARENA_H,
  ARENA_W,
  createGame,
  SAUCER_H,
  SAUCER_INTERVAL_BASE,
  SAUCER_W,
  SAUCER_Y,
  SHIELD_CELLS_X,
  SHIELD_CELLS_Y,
  SHIELD_H,
  SHIELD_W,
  SHIP_INVINCIBLE_MS,
  SHIP_LIVES,
  SHIP_SHOOT_COOLDOWN,
  SHIP_W,
  SHIP_Y,
  spawnWave,
  standingsFor,
  stepFixed,
  WAVE_COUNT,
  type GameState,
  type InputFrame,
  type PlayerInput,
} from "../src/game.js";

const IDLE: PlayerInput = { axis: 0, shoot: false, start: false, back: false };

function ctx(count: number = 2): LaunchContext {
  const players = [
    { slot: 0, profileId: "a", displayName: "P1", color: "#ef4444", gamepadIndex: 0 },
    { slot: 1, profileId: "b", displayName: "P2", color: "#3b82f6", gamepadIndex: 1 },
    { slot: 2, profileId: "c", displayName: "P3", color: "#22c55e", gamepadIndex: 2 },
    { slot: 3, profileId: "d", displayName: "P4", color: "#f59e0b", gamepadIndex: 3 },
  ].slice(0, count);
  return {
    sessionId: "s1",
    sdkVersion: "1.0.0",
    settings: {},
    players,
  };
}

function playingState(playerCount: number = 2): GameState {
  const s = createGame(ctx(playerCount));
  s.wave = 1;
  spawnWave(s);
  s.phase = "playing";
  return s;
}

function idleFrame(playerCount: number = 1): InputFrame {
  return {
    inputs: new Array(playerCount).fill(null).map(() => ({ ...IDLE })),
    anyStart: false,
  };
}

function shootFrame(playerCount: number = 1): InputFrame {
  return {
    inputs: new Array(playerCount)
      .fill(null)
      .map(() => ({ axis: 0, shoot: true, start: false, back: false })),
    anyStart: false,
  };
}

function startFrame(playerCount: number = 1): InputFrame {
  return {
    inputs: new Array(playerCount).fill(null).map(() => ({ ...IDLE })),
    anyStart: true,
  };
}

// =============================================================================
// Core physics (from original suite)
// =============================================================================

describe("ship movement", () => {
  it("spawns multiplayer ships in separate lanes", () => {
    const s = createGame(ctx(4));
    const xs = s.players.map((player) => player.x);
    expect(new Set(xs).size).toBe(4);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it("respawns a ship at its assigned lane", () => {
    const s = playingState(3);
    const spawnX = s.players[1]!.spawnX;
    s.players[1]!.x = 0;
    s.players[1]!.respawnTimer = 20;
    s.players[1]!.lives = 2;

    advance(s, 20, idleFrame(3));

    expect(s.players[1]!.x).toBe(spawnX);
    expect(s.players[1]!.respawnTimer).toBe(0);
  });

  it("moves right when axis is positive", () => {
    const s = playingState(1);
    const startX = s.players[0]!.x;
    advance(s, 200, {
      inputs: [{ axis: 1, shoot: false, start: false, back: false }],
      anyStart: false,
    });
    expect(s.players[0]!.x).toBeGreaterThan(startX);
  });

  it("moves left when axis is negative", () => {
    const s = playingState(1);
    s.players[0]!.x = ARENA_W / 2;
    advance(s, 200, {
      inputs: [{ axis: -1, shoot: false, start: false, back: false }],
      anyStart: false,
    });
    expect(s.players[0]!.x).toBeLessThan(ARENA_W / 2);
  });

  it("clamps ship to arena bounds", () => {
    const s = playingState(1);
    s.players[0]!.x = SHIP_W / 2;
    advance(s, 100, {
      inputs: [{ axis: -1, shoot: false, start: false, back: false }],
      anyStart: false,
    });
    expect(s.players[0]!.x).toBeGreaterThanOrEqual(SHIP_W / 2);

    s.players[0]!.x = ARENA_W - SHIP_W / 2;
    advance(s, 100, {
      inputs: [{ axis: 1, shoot: false, start: false, back: false }],
      anyStart: false,
    });
    expect(s.players[0]!.x).toBeLessThanOrEqual(ARENA_W - SHIP_W / 2);
  });
});

describe("player shooting", () => {
  it("fires a bullet when shoot is pressed", () => {
    const s = playingState(1);
    advance(s, 100, {
      inputs: [{ axis: 0, shoot: true, start: false, back: false }],
      anyStart: false,
    });
    expect(s.players[0]!.bullet).not.toBeNull();
    expect(s.events).toContain("shoot");
  });

  it("bullet moves upward", () => {
    const s = playingState(1);
    s.players[0]!.bullet = { x: ARENA_W / 2, y: SHIP_Y - 40 };
    const startY = s.players[0]!.bullet.y;
    advance(s, 100, idleFrame(1));
    if (s.players[0]!.bullet) {
      expect(s.players[0]!.bullet.y).toBeLessThan(startY);
    }
  });
});

describe("alien hits", () => {
  it("a player bullet kills an alien and awards score", () => {
    const s = playingState(1);
    const alienX = s.alienGridX + ALIEN_W / 2;
    const alienY = s.alienGridY + ALIEN_H / 2;
    s.players[0]!.bullet = { x: alienX, y: alienY };
    expect(s.aliens[0]![0]!.alive).toBe(true);
    advance(s, 100, idleFrame(1));
    expect(s.aliens[0]![0]!.alive).toBe(false);
    expect(s.players[0]!.score).toBe(50);
    expect(s.players[0]!.aliensKilled).toBe(1);
  });

  it("awards correct score for row 4 alien (bottom row)", () => {
    const s = playingState(1);
    const alienX = s.alienGridX + ALIEN_W / 2;
    const alienY = s.alienGridY + 4 * (ALIEN_H + ALIEN_GAP_Y) + ALIEN_H / 2;
    s.players[0]!.bullet = { x: alienX, y: alienY };
    advance(s, 100, idleFrame(1));
    expect(s.aliens[4]![0]!.alive).toBe(false);
    expect(s.players[0]!.score).toBe(10);
  });
});

describe("alien bullets", () => {
  it("an alien bullet kills a player", () => {
    const s = playingState(1);
    s.alienBullets.push({ x: s.players[0]!.x, y: SHIP_Y });
    advance(s, 100, idleFrame(1));
    expect(s.players[0]!.lives).toBe(SHIP_LIVES - 1);
    expect(s.players[0]!.respawnTimer).toBeGreaterThan(0);
    expect(s.events).toContain("playerHit");
  });

  it("an alien bullet does NOT kill an invincible player", () => {
    const s = playingState(1);
    s.players[0]!.invincibleTimer = SHIP_INVINCIBLE_MS;
    s.alienBullets.push({ x: s.players[0]!.x, y: SHIP_Y });
    advance(s, 100, idleFrame(1));
    expect(s.players[0]!.lives).toBe(SHIP_LIVES);
  });
});

describe("shields", () => {
  it("a player bullet destroys a shield cell", () => {
    const s = playingState(1);
    const shield = s.shields[0]!;
    let aliveBefore = 0;
    for (let cx = 0; cx < SHIELD_CELLS_X; cx++) {
      for (let cy = 0; cy < SHIELD_CELLS_Y; cy++) {
        if (shield.cells[cx]![cy]) aliveBefore++;
      }
    }
    s.players[0]!.bullet = {
      x: shield.x + SHIELD_W / 2,
      y: shield.y + SHIELD_H - 5,
    };
    advance(s, 17, idleFrame(1));
    let aliveAfter = 0;
    for (let cx = 0; cx < SHIELD_CELLS_X; cx++) {
      for (let cy = 0; cy < SHIELD_CELLS_Y; cy++) {
        if (shield.cells[cx]![cy]) aliveAfter++;
      }
    }
    expect(aliveAfter).toBeLessThan(aliveBefore);
    expect(s.players[0]!.bullet).toBeNull();
  });
});

describe("alien grid movement", () => {
  it("reverses direction and descends when hitting left wall", () => {
    const s = playingState(1);
    s.alienGridX = 0;
    s.alienDir = -1;
    const startY = s.alienGridY;
    stepFixed(s);
    expect(s.alienDir).toBe(1);
    expect(s.alienGridY).toBeGreaterThan(startY);
  });

  it("reverses direction and descends when hitting right wall", () => {
    const s = playingState(1);
    s.alienGridX = ARENA_W - 14;
    s.alienDir = 1;
    const startY = s.alienGridY;
    stepFixed(s);
    expect(s.alienDir).toBe(-1);
    expect(s.alienGridY).toBeGreaterThan(startY);
  });
});

// =============================================================================
// State machine & lifecycle
// =============================================================================

describe("lifecycle", () => {
  it("starts in attract phase", () => {
    const s = createGame(ctx(2));
    expect(s.phase).toBe("attract");
    expect(s.wave).toBe(0);
    expect(s.players).toHaveLength(2);
  });

  it("transitions attract → wavetransition on start", () => {
    const s = createGame(ctx(1));
    advance(s, 16, startFrame(1));
    expect(s.phase).toBe("wavetransition");
  });

  it("transitions wavetransition → playing after banner timer", () => {
    const s = createGame(ctx(1));
    // Trigger attract → wavetransition
    advance(s, 16, startFrame(1));
    expect(s.phase).toBe("wavetransition");
    // Advance past the banner (dt is clamped to 100ms per call)
    for (let i = 0; i < 19; i++) {
      advance(s, 100, idleFrame(1));
    }
    expect(s.phase).toBe("playing");
  });

  it("reports standings exactly once after gameover timer", () => {
    const s = playingState(1);
    s.phase = "gameover";
    s.goTimer = 50; // nearly expired
    s.ended = false;

    expect(advance(s, 30, idleFrame(1))).toBeNull();
    expect(s.ended).toBe(false);

    const standings = advance(s, 30, idleFrame(1));
    expect(standings).not.toBeNull();
    expect(s.ended).toBe(true);

    // No double-report
    expect(advance(s, 100, idleFrame(1))).toBeNull();
  });
});

// =============================================================================
// Player systems
// =============================================================================

describe("player respawning", () => {
  it("player respawns after SHIP_RESPAWN_MS with invincibility", () => {
    const s = playingState(1);
    s.players[0]!.lives = 2; // will have 1 life left after death
    s.alienBullets.push({ x: s.players[0]!.x, y: SHIP_Y });

    // Kill the player
    advance(s, 20, idleFrame(1));
    expect(s.players[0]!.lives).toBe(1); // had 2, lost 1
    expect(s.players[0]!.respawnTimer).toBeGreaterThan(0);

    // Wait through the respawn timer (dt is clamped to 100ms per call)
    for (let i = 0; i < 13; i++) {
      advance(s, 100, idleFrame(1));
    }
    expect(s.players[0]!.respawnTimer).toBe(0);
    expect(s.players[0]!.invincibleTimer).toBeGreaterThan(0);
  });

  it("invincibility timer counts down", () => {
    const s = playingState(1);
    s.players[0]!.invincibleTimer = 500;
    advance(s, 200, idleFrame(1));
    expect(s.players[0]!.invincibleTimer).toBeLessThan(500);
  });

  it("dead player cannot move", () => {
    const s = playingState(1);
    s.players[0]!.respawnTimer = 500;
    const x = s.players[0]!.x;
    advance(s, 100, {
      inputs: [{ axis: 1, shoot: false, start: false, back: false }],
      anyStart: false,
    });
    expect(s.players[0]!.x).toBe(x); // unchanged
  });

  it("dead player cannot shoot", () => {
    const s = playingState(1);
    s.players[0]!.respawnTimer = 500;
    s.players[0]!.bullet = null;
    advance(s, 100, shootFrame(1));
    expect(s.players[0]!.bullet).toBeNull();
  });
});

describe("shoot cooldown", () => {
  it("prevents shooting again before cooldown expires", () => {
    const s = playingState(1);
    // First shot
    advance(s, 20, shootFrame(1));
    expect(s.players[0]!.bullet).not.toBeNull();
    expect(s.players[0]!.shotsFired).toBe(1);

    // Remove the bullet to simulate it having been destroyed
    s.players[0]!.bullet = null;

    // Try to shoot immediately — cooldown still active, should be blocked
    advance(s, 17, shootFrame(1));
    expect(s.players[0]!.bullet).toBeNull();

    // Advance past the cooldown (dt is clamped to 100ms per advance)
    for (let i = 0; i < 4; i++) {
      advance(s, 100, idleFrame(1));
    }

    // Now shoot should work
    advance(s, 20, shootFrame(1));
    expect(s.players[0]!.bullet).not.toBeNull();
    expect(s.players[0]!.shotsFired).toBe(2);
  });

  it("cannot have two bullets at once", () => {
    const s = playingState(1);
    // Fire first bullet
    advance(s, 20, shootFrame(1));
    expect(s.players[0]!.bullet).not.toBeNull();
    const firstBullet = s.players[0]!.bullet;

    // Wait for cooldown, try to fire second
    advance(s, SHIP_SHOOT_COOLDOWN + 20, shootFrame(1));
    // Should still be the same bullet, not a new one
    expect(s.players[0]!.bullet).toBe(firstBullet);
    expect(s.players[0]!.shotsFired).toBe(1);
  });
});

// =============================================================================
// Multi-player
// =============================================================================

describe("multi-player", () => {
  it("each player tracks independent score", () => {
    const s = playingState(3);
    // P1 kills row-0 alien
    const a0x = s.alienGridX + ALIEN_W / 2;
    const a0y = s.alienGridY + ALIEN_H / 2;
    s.players[0]!.bullet = { x: a0x, y: a0y };
    advance(s, 20, idleFrame(3));
    expect(s.players[0]!.score).toBe(50);
    expect(s.players[1]!.score).toBe(0);
    expect(s.players[2]!.score).toBe(0);
  });

  it("players can shoot simultaneously", () => {
    const s = playingState(2);
    advance(s, 20, shootFrame(2));
    expect(s.players[0]!.bullet).not.toBeNull();
    expect(s.players[1]!.bullet).not.toBeNull();
    expect(s.players[0]!.shotsFired).toBe(1);
    expect(s.players[1]!.shotsFired).toBe(1);
  });

  it("one dead player does not prevent others from playing", () => {
    const s = playingState(2);
    // Kill P1
    s.players[0]!.lives = 1;
    s.alienBullets.push({ x: s.players[0]!.x, y: SHIP_Y });
    advance(s, 20, idleFrame(2));
    expect(s.players[0]!.respawnTimer).toBeGreaterThan(0);

    // P2 should still move and shoot
    advance(s, 20, shootFrame(2));
    expect(s.players[1]!.bullet).not.toBeNull();
    expect(s.players[0]!.bullet).toBeNull();
  });
});

// =============================================================================
// Alien systems
// =============================================================================

describe("alien shooting", () => {
  it("aliens shoot bullets downward", () => {
    const s = playingState(1);
    s.alienShootTimer = 0;
    const before = s.alienBullets.length;
    stepFixed(s);
    expect(s.alienBullets.length).toBeGreaterThan(before);
  });

  it("alien bullets are removed when they leave screen bottom", () => {
    const s = playingState(1);
    s.alienBullets.push({ x: 100, y: ARENA_H + 5 });
    stepFixed(s);
    expect(s.alienBullets.length).toBe(0);
  });

  it("alien bullet destroys a shield cell", () => {
    const s = playingState(1);
    const shield = s.shields[0]!;
    let aliveBefore = 0;
    for (let cx = 0; cx < SHIELD_CELLS_X; cx++) {
      for (let cy = 0; cy < SHIELD_CELLS_Y; cy++) {
        if (shield.cells[cx]![cy]) aliveBefore++;
      }
    }

    // Place alien bullet in the middle of the shield
    s.alienBullets.push({
      x: shield.x + SHIELD_W / 2,
      y: shield.y + SHIELD_H / 2,
    });
    advance(s, 20, idleFrame(1));

    let aliveAfter = 0;
    for (let cx = 0; cx < SHIELD_CELLS_X; cx++) {
      for (let cy = 0; cy < SHIELD_CELLS_Y; cy++) {
        if (shield.cells[cx]![cy]) aliveAfter++;
      }
    }
    expect(aliveAfter).toBeLessThan(aliveBefore);
  });

  it("alien speed increases per wave", () => {
    const s = createGame(ctx(1));
    s.wave = 1;
    spawnWave(s);
    const speed1 = s.alienSpeed;

    s.wave = 2;
    spawnWave(s);
    const speed2 = s.alienSpeed;

    expect(speed2).toBeGreaterThan(speed1);
  });

  it("alien grid speeds up on each wall bounce", () => {
    const s = playingState(1);
    s.alienGridX = 0;
    s.alienDir = -1;
    const speedBefore = s.alienSpeed;
    stepFixed(s);
    expect(s.alienSpeed).toBeGreaterThan(speedBefore);
  });
});

describe("alien invasion", () => {
  it("triggers game over when aliens reach the player zone", () => {
    const s = playingState(1);
    // Push the grid down near the ships
    s.alienGridY = SHIP_Y - 30;
    // Trigger a descend by hitting a wall
    s.alienGridX = 0;
    s.alienDir = -1;
    stepFixed(s);
    expect(s.phase).toBe("gameover");
    expect(s.events).toContain("gameOver");
  });
});

// =============================================================================
// Saucer
// =============================================================================

describe("saucer", () => {
  it("saucer hit awards points to the player who shot it", () => {
    const s = playingState(1);
    s.saucer = { x: 400, y: SAUCER_Y, dir: 1, points: 300 };
    s.players[0]!.bullet = { x: 400, y: SAUCER_Y + SAUCER_H / 2 };
    advance(s, 20, idleFrame(1));
    expect(s.players[0]!.score).toBe(300);
    expect(s.saucer).toBeNull();
    expect(s.events).toContain("saucerHit");
  });

  it("saucer despawns when it moves off-screen", () => {
    const s = playingState(1);
    s.saucer = { x: ARENA_W + SAUCER_W - 2, y: 40, dir: 1, points: 100 };
    stepFixed(s);
    expect(s.saucer).toBeNull();
    expect(s.saucerSound).toBe(false);
  });

  it("saucer spawns when saucerTimer expires", () => {
    const s = playingState(1);
    s.saucer = null;
    s.saucerTimer = 0;
    stepFixed(s);
    expect(s.saucer).not.toBeNull();
  });
});

// =============================================================================
// Waves & victory
// =============================================================================

describe("wave mechanics", () => {
  it("shields partially repair between waves", () => {
    const s = playingState(1);
    // Destroy all cells in the first shield
    const shield = s.shields[0]!;
    for (let cx = 0; cx < SHIELD_CELLS_X; cx++) {
      for (let cy = 0; cy < SHIELD_CELLS_Y; cy++) {
        shield.cells[cx]![cy] = false;
      }
    }
    // Re-spawn (simulates between-wave repair)
    spawnWave(s);
    // At least one cell should be back
    let aliveAfter = 0;
    for (let cx = 0; cx < SHIELD_CELLS_X; cx++) {
      for (let cy = 0; cy < SHIELD_CELLS_Y; cy++) {
        if (shield.cells[cx]![cy]) aliveAfter++;
      }
    }
    expect(aliveAfter).toBeGreaterThan(0);
  });

  it("spawnWave respawns dead players who have lives", () => {
    const s = playingState(2);
    // Kill P1 (but they have 2 lives left)
    s.players[0]!.lives = 2;
    s.players[0]!.respawnTimer = 500; // dead, respawning
    s.players[1]!.lives = 0; // P2 dead for good
    s.players[1]!.respawnTimer = 999999;

    spawnWave(s);
    expect(s.players[0]!.respawnTimer).toBe(0);
    expect(s.players[0]!.invincibleTimer).toBe(SHIP_INVINCIBLE_MS);
    // P2 stays dead
    expect(s.players[1]!.respawnTimer).toBe(999999);
  });

  it("spawnWave clears all alien bullets", () => {
    const s = playingState(1);
    s.alienBullets.push({ x: 100, y: 200 }, { x: 200, y: 300 });
    spawnWave(s);
    expect(s.alienBullets.length).toBe(0);
  });

  it("spawnWave creates a full grid of aliens", () => {
    const s = playingState(1);
    spawnWave(s);
    expect(s.aliens.length).toBe(ALIEN_ROWS);
    expect(s.aliens[0]!.length).toBe(ALIEN_COLS);
    for (let row = 0; row < ALIEN_ROWS; row++) {
      for (let col = 0; col < ALIEN_COLS; col++) {
        expect(s.aliens[row]![col]!.alive).toBe(true);
      }
    }
  });
});

describe("victory", () => {
  it("triggers victory when final wave is cleared", () => {
    const s = playingState(1);
    s.wave = WAVE_COUNT; // last wave
    // Kill all aliens
    for (let row = 0; row < ALIEN_ROWS; row++) {
      for (let col = 0; col < ALIEN_COLS; col++) {
        s.aliens[row]![col]!.alive = false;
      }
    }
    advance(s, 20, idleFrame(1));
    expect(s.victory).toBe(true);
    expect(s.phase).toBe("gameover");
    expect(s.events).toContain("victory");
  });
});

// =============================================================================
// Stats & scoring
// =============================================================================

describe("stats", () => {
  it("tracks deaths per player", () => {
    const s = playingState(1);
    const deathsBefore = s.players[0]!.deaths;
    s.players[0]!.lives = 2;
    s.alienBullets.push({ x: s.players[0]!.x, y: SHIP_Y });
    advance(s, 20, idleFrame(1));
    expect(s.players[0]!.deaths).toBe(deathsBefore + 1);
  });

  it("standings includes per-player stats", () => {
    const s = playingState(2);
    s.players[0]!.score = 200;
    s.players[0]!.aliensKilled = 5;
    s.players[0]!.shotsFired = 10;
    s.players[0]!.deaths = 1;
    s.players[1]!.score = 100;
    s.players[1]!.aliensKilled = 3;
    s.players[1]!.shotsFired = 12;
    s.players[1]!.deaths = 2;

    const standings = standingsFor(s);
    expect(standings[0]!.stats).toMatchObject({
      aliensKilled: 5,
      shotsFired: 10,
      accuracy: 50, // 5/10 * 100
      deaths: 1,
    });
    expect(standings[1]!.stats).toMatchObject({
      aliensKilled: 3,
      shotsFired: 12,
      accuracy: 25, // 3/12 * 100
      deaths: 2,
    });
  });

  it("accuracy is 0 when no shots fired", () => {
    const s = playingState(1);
    s.players[0]!.shotsFired = 0;
    s.players[0]!.aliensKilled = 0;
    const standings = standingsFor(s);
    expect(standings[0]!.stats!.accuracy).toBe(0);
  });

  it("totalAliensKilled accumulates across players", () => {
    const s = playingState(2);
    const alienX = s.alienGridX + ALIEN_W / 2;
    const alienY = s.alienGridY + ALIEN_H / 2;

    // P1 kills one
    s.players[0]!.bullet = { x: alienX, y: alienY };
    advance(s, 20, idleFrame(2));
    expect(s.totalAliensKilled).toBe(1);

    // P2 kills another (same col, row 0)
    // Need a new alien alive — we killed [0][0], so use [0][1]
    s.alienGridY; // anchor
    const a1x = s.alienGridX + 1 * (ALIEN_W + ALIEN_GAP_X) + ALIEN_W / 2;
    s.players[1]!.bullet = { x: a1x, y: alienY };
    advance(s, 20, idleFrame(2));
    expect(s.totalAliensKilled).toBe(2);
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe("edge cases", () => {
  it("player bullet is removed off screen top", () => {
    const s = playingState(1);
    s.players[0]!.bullet = { x: 100, y: -20 };
    advance(s, 20, idleFrame(1));
    expect(s.players[0]!.bullet).toBeNull();
  });

  it("dt is clamped to 100ms to prevent spiral of death", () => {
    const s = playingState(1);
    s.players[0]!.x = 400;
    // With 500ms dt, ship should still only move ~100ms worth
    const xBefore = s.players[0]!.x;
    advance(s, 500, {
      inputs: [{ axis: 1, shoot: false, start: false, back: false }],
      anyStart: false,
    });
    // Ship wouldn't have moved 380px/sec for 500ms (190px);
    // it moved ~380*0.1 = 38px max
    expect(s.players[0]!.x).toBeLessThan(xBefore + 50);
  });

  it("phase does not change mid-frame when accumulator is drained in chunks", () => {
    const s = playingState(1);
    s.acc = 0;

    // Fire a bullet that will kill the last alien
    // Kill all but one alien
    for (let row = 0; row < ALIEN_ROWS; row++) {
      for (let col = 0; col < ALIEN_COLS; col++) {
        if (row === 0 && col === 0) continue; // leave one alive
        s.aliens[row]![col]!.alive = false;
      }
    }
    const ax = s.alienGridX + ALIEN_W / 2;
    const ay = s.alienGridY + ALIEN_H / 2;
    s.players[0]!.bullet = { x: ax, y: ay };

    // Drain with a small dt — should detect wave clear after killing
    advance(s, 20, idleFrame(1));
    expect(s.aliens[0]![0]!.alive).toBe(false);
    expect(s.phase).toBe("wavetransition");
  });

  it("createGame populates the correct number of stars", () => {
    const s = createGame(ctx(1));
    expect(s.stars.length).toBe(80);
  });

  it("createGame creates exactly 4 shields", () => {
    const s = createGame(ctx(1));
    expect(s.shields).toHaveLength(4);
  });

  it("standings includes slot and profileId for each player", () => {
    const s = playingState(2);
    const standings = standingsFor(s);
    expect(standings[0]!.slot).toBeDefined();
    expect(standings[0]!.profileId).toBeDefined();
    expect(standings[1]!.slot).toBeDefined();
  });

  it("invincible ship is not harmed but bullet passes through", () => {
    const s = playingState(1);
    s.players[0]!.invincibleTimer = 5000;
    s.alienBullets.push({ x: s.players[0]!.x, y: SHIP_Y });
    advance(s, 20, idleFrame(1));
    expect(s.players[0]!.lives).toBe(SHIP_LIVES); // no damage
    // Bullet passes through invincible ship and continues off-screen
    expect(s.alienBullets.length).toBeLessThanOrEqual(1);
  });
});

// =============================================================================
// Phase-specific behavior
// =============================================================================

describe("phase safety", () => {
  it("stepFixed is a no-op during attract", () => {
    const s = createGame(ctx(1));
    s.alienGridX = 400;
    stepFixed(s);
    // Grid shouldn't move
    expect(s.alienGridX).toBe(400);
  });

  it("stepFixed is a no-op during wavetransition", () => {
    const s = playingState(1);
    s.phase = "wavetransition";
    const startX = s.alienGridX;
    stepFixed(s);
    expect(s.alienGridX).toBe(startX);
  });

  it("stepFixed is a no-op during gameover", () => {
    const s = playingState(1);
    s.phase = "gameover";
    const startX = s.alienGridX;
    stepFixed(s);
    expect(s.alienGridX).toBe(startX);
  });

  it("aliens do not shoot in wavetransition", () => {
    const s = playingState(1);
    s.phase = "wavetransition";
    s.alienShootTimer = 0;
    const before = s.alienBullets.length;
    stepFixed(s);
    expect(s.alienBullets.length).toBe(before);
  });
});

// =============================================================================
// Four-player edge cases
// =============================================================================

describe("four-player", () => {
  it("all 4 players are created", () => {
    const s = playingState(4);
    expect(s.players).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(s.players[i]!.lives).toBe(SHIP_LIVES);
    }
  });

  it("game over when all 4 players have 0 lives", () => {
    const s = playingState(4);
    for (const p of s.players) {
      p.lives = 1; // one hit kills each
    }
    for (const p of s.players) {
      s.alienBullets.push({ x: p.x, y: SHIP_Y });
    }
    advance(s, 100, idleFrame(4));
    expect(s.phase).toBe("gameover");
  });
});

// =============================================================================
// Filling remaining gaps
// =============================================================================

describe("spawnWave resets", () => {
  it("resets grid position to top-left", () => {
    const s = playingState(1);
    // Push the grid away from start
    s.alienGridX = 300;
    s.alienGridY = 400;
    s.alienDir = -1;
    spawnWave(s);
    expect(s.alienGridX).toBe(ALIEN_GRID_START_X);
    expect(s.alienGridY).toBe(ALIEN_GRID_START_Y);
    expect(s.alienDir).toBe(1);
  });

  it("removes the saucer and resets saucer timer", () => {
    const s = playingState(1);
    s.saucer = { x: 200, y: 40, dir: 1, points: 100 };
    s.saucerSound = true;
    s.saucerTimer = 5000;
    spawnWave(s);
    expect(s.saucer).toBeNull();
    expect(s.saucerTimer).toBeGreaterThan(SAUCER_INTERVAL_BASE);
  });
});

describe("goToGameOver", () => {
  it("clears all players' lives and bullets", () => {
    const s = playingState(2);
    s.players[0]!.bullet = { x: 100, y: 200 };
    s.players[1]!.bullet = { x: 500, y: 300 };
    s.alienBullets.push({ x: 100, y: 100 });

    // Trigger invasion to reach goToGameOver
    s.alienGridY = SHIP_Y - 30;
    s.alienGridX = 0;
    s.alienDir = -1;
    stepFixed(s);

    expect(s.phase).toBe("gameover");
    for (const p of s.players) {
      expect(p.lives).toBe(0);
      expect(p.respawnTimer).toBe(999999);
      expect(p.bullet).toBeNull();
    }
  });

  it("sets victory to false", () => {
    const s = playingState(1);
    s.victory = false; // explicit, but confirm goToGameOver doesn't flip it
    s.alienGridY = SHIP_Y - 30;
    s.alienGridX = 0;
    s.alienDir = -1;
    stepFixed(s);
    expect(s.victory).toBe(false);
  });
});

describe("alien speed cap", () => {
  it("caps at ALIEN_SPEED_MAX", () => {
    const s = createGame(ctx(1));
    // Simulate many waves
    s.wave = 50;
    spawnWave(s);
    expect(s.alienSpeed).toBeLessThanOrEqual(ALIEN_SPEED_MAX);
  });
});

describe("saucer sound lifecycle", () => {
  it("sets saucerSound to true when saucer spawns", () => {
    const s = playingState(1);
    s.saucerSound = false;
    s.saucerTimer = 0;
    stepFixed(s);
    expect(s.saucer).not.toBeNull();
    expect(s.saucerSound).toBe(true);
  });

  it("clears saucerSound when saucer is destroyed by bullet", () => {
    const s = playingState(1);
    s.saucer = { x: 400, y: SAUCER_Y, dir: 1, points: 100 };
    s.saucerSound = true;
    s.players[0]!.bullet = { x: 400, y: SAUCER_Y + SAUCER_H / 2 };
    advance(s, 20, idleFrame(1));
    expect(s.saucer).toBeNull();
    expect(s.saucerSound).toBe(false);
  });

  it("clears saucerSound when saucer leaves the screen", () => {
    const s = playingState(1);
    s.saucer = { x: ARENA_W + SAUCER_W - 2, y: SAUCER_Y, dir: 1, points: 50 };
    s.saucerSound = true;
    stepFixed(s);
    expect(s.saucer).toBeNull();
    expect(s.saucerSound).toBe(false);
  });
});

describe("alien shooting column selection", () => {
  it("shoots from bottommost alive alien in a column", () => {
    const s = playingState(1);
    s.alienShootTimer = 0;
    // Kill bottom two rows of column 0
    s.aliens[3]![0]!.alive = false;
    s.aliens[4]![0]!.alive = false;

    // Clear all other columns so only col 0 is eligible
    for (let col = 1; col < ALIEN_COLS; col++) {
      for (let row = 0; row < ALIEN_ROWS; row++) {
        s.aliens[row]![col]!.alive = false;
      }
    }

    // The bottommost alive in col 0 is now row 2 (index 2)
    stepFixed(s);
    // Should have one new bullet from col 0, fired from row 2's position
    expect(s.alienBullets.length).toBe(1);
    if (s.alienBullets[0]) {
      const expectedY = s.alienGridY + 2 * (ALIEN_H + ALIEN_GAP_Y) + ALIEN_H / 2 + ALIEN_H / 2;
      expect(s.alienBullets[0].y).toBeCloseTo(expectedY, 0);
    }
  });
});

describe("3-player standings", () => {
  it("ranks 3 players correctly with mixed scores", () => {
    const s = playingState(3);
    s.players[0]!.score = 500;
    s.players[1]!.score = 300;
    s.players[2]!.score = 100;

    const standings = standingsFor(s);
    expect(standings[0]!.rank).toBe(1);
    expect(standings[0]!.score).toBe(500);
    expect(standings[1]!.rank).toBe(2);
    expect(standings[1]!.score).toBe(300);
    expect(standings[2]!.rank).toBe(3);
    expect(standings[2]!.score).toBe(100);
  });

  it("two-way tie in 3-player match skips rank 2", () => {
    const s = playingState(3);
    s.players[0]!.score = 400;
    s.players[1]!.score = 400; // tied
    s.players[2]!.score = 50;

    const standings = standingsFor(s);
    expect(standings[0]!.rank).toBe(1);
    expect(standings[1]!.rank).toBe(1);
    expect(standings[2]!.rank).toBe(3); // rank 2 is skipped
  });
});
