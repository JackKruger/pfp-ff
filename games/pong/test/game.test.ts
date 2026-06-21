import { describe, expect, it } from "vitest";
import type { LaunchContext } from "@pfp/sdk";
import {
  advance,
  ARENA_H,
  ARENA_W,
  BALL_SIZE,
  createGame,
  PADDLE_H,
  stepFixed,
  WIN_SCORE,
  type GameState,
  type PlayerInput,
} from "../src/game.js";

const IDLE: PlayerInput = { axis: 0, start: false, back: false };

function ctx(): LaunchContext {
  return {
    sessionId: "s1",
    sdkVersion: "1.0.0",
    settings: {},
    players: [
      { slot: 0, profileId: "a", displayName: "P1", color: "#ef4444", gamepadIndex: 0 },
      { slot: 1, profileId: "b", displayName: "P2", color: "#3b82f6", gamepadIndex: 1 },
    ],
  };
}

function rallyState(): GameState {
  const s = createGame(ctx());
  s.phase = "rally";
  return s;
}

describe("pong physics", () => {
  it("reflects the ball off the top wall", () => {
    const s = rallyState();
    s.ball.x = ARENA_W / 2;
    s.ball.y = 1;
    s.ball.vx = 0;
    s.ball.vy = -300;
    stepFixed(s);
    expect(s.ball.vy).toBeGreaterThan(0);
    expect(s.ball.y).toBeGreaterThanOrEqual(0);
    expect(s.events).toContain("wall");
  });

  it("scores for the left player when the ball passes the right wall", () => {
    const s = rallyState();
    s.ball.x = ARENA_W - 1;
    s.ball.y = ARENA_H / 2;
    s.ball.vx = 600;
    s.ball.vy = 0;
    expect(stepFixed(s)).toBe(0); // index 0 = left player scores
  });

  it("scores for the right player when the ball passes the left wall", () => {
    const s = rallyState();
    s.ball.x = -BALL_SIZE + 1;
    s.ball.y = ARENA_H / 2;
    s.ball.vx = -600;
    s.ball.vy = 0;
    expect(stepFixed(s)).toBe(1);
  });

  it("clamps paddles within the arena", () => {
    const s = rallyState();
    s.players[0].paddleY = -500;
    s.players[0].axis = -1;
    stepFixed(s);
    expect(s.players[0].paddleY).toBeGreaterThanOrEqual(0);

    s.players[1].paddleY = ARENA_H + 500;
    s.players[1].axis = 1;
    stepFixed(s);
    expect(s.players[1].paddleY).toBeLessThanOrEqual(ARENA_H - PADDLE_H);
  });
});

describe("pong match flow", () => {
  it("starts a serve when a player presses start", () => {
    const s = createGame(ctx());
    expect(s.phase).toBe("attract");
    advance(s, 16, { axis: 0, start: true, back: false }, IDLE);
    expect(s.phase).toBe("serving");
  });

  it("ends the match and ranks the higher score first", () => {
    const s = rallyState();
    s.players[0].score = WIN_SCORE - 1;
    // Position the ball to cross the right wall → left player (index 0) scores the winning point.
    s.ball.x = ARENA_W - 1;
    s.ball.y = ARENA_H / 2;
    s.ball.vx = 600;
    s.ball.vy = 0;

    let standings = advance(s, 16, IDLE, IDLE);
    expect(standings).toBeNull(); // win banner hold
    expect(s.phase).toBe("gameover");
    expect(s.players[0].score).toBe(WIN_SCORE);

    // Drain the banner hold; standings reported exactly once.
    for (let i = 0; i < 40 && standings === null; i++) {
      standings = advance(s, 100, IDLE, IDLE);
    }
    expect(standings).not.toBeNull();
    expect(standings![0]).toMatchObject({ slot: 0, rank: 1, score: WIN_SCORE });
    expect(standings![1]).toMatchObject({ slot: 1, rank: 2 });

    // No double-report.
    expect(advance(s, 100, IDLE, IDLE)).toBeNull();
  });
});
