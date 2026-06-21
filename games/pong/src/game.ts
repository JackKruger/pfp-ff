import type { LaunchContext, PlayerStanding } from "@pfp/sdk";

// --- Tuning constants (logical units; arena is 1280x720) ----------------------
export const ARENA_W = 1280;
export const ARENA_H = 720;
export const FIXED_DT = 1 / 120; // seconds per physics step
export const FIXED_MS = 1000 / 120;
export const PADDLE_W = 18;
export const PADDLE_H = 120;
export const PADDLE_MARGIN = 48; // paddle face distance from each side wall
export const PADDLE_SPEED = 900; // units/sec
export const BALL_SIZE = 18;
export const BALL_START_SPEED = 520;
export const BALL_SPEEDUP = 1.04;
export const BALL_MAX_SPEED = 1300;
export const WIN_SCORE = 11;
export const SERVE_DELAY_MS = 800;
export const WIN_HOLD_MS = 1800; // show the winner banner before reporting to the shell
export const MAX_BOUNCE_RAD = (50 * Math.PI) / 180;

const SHAKE_DECAY = 60; // px/sec
const TRAIL_LEN = 9;

export type SoundKind = "wall" | "paddle" | "score" | "win";
export type Phase = "attract" | "serving" | "rally" | "gameover";

/** Per-player input for one frame. `start`/`back` are edge-triggered (this frame only). */
export interface PlayerInput {
  axis: number; // -1 (up) .. +1 (down)
  start: boolean;
  back: boolean;
}

export interface Player {
  slot: number;
  profileId: string | null;
  displayName: string;
  color: string;
  gamepadIndex: number;
  score: number;
  paddleY: number; // top of paddle
  axis: number;
}

export interface Ball {
  x: number; // top-left
  y: number;
  vx: number;
  vy: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number; // ms remaining
  maxLife: number;
}

export interface GameState {
  players: [Player, Player];
  ball: Ball;
  phase: Phase;
  serveTimer: number; // ms remaining in serve countdown
  serveDir: 1 | -1; // +1 = toward right player, -1 = toward left
  winner: Player | null;
  goTimer: number; // ms remaining on the winner banner before reporting
  ended: boolean; // standings already reported
  shake: number; // current shake magnitude (px)
  particles: Particle[];
  trail: { x: number; y: number }[];
  flashSide: 0 | 1 | -1; // which wall just got scored on (-1 = none)
  flashTimer: number; // ms remaining on the goal flash
  events: SoundKind[]; // drained by main each frame for audio
  acc: number; // fixed-step accumulator (ms)
}

function makePlayer(p: LaunchContext["players"][number]): Player {
  return {
    slot: p.slot,
    profileId: p.profileId,
    displayName: p.displayName,
    color: p.color,
    gamepadIndex: p.gamepadIndex,
    score: 0,
    paddleY: ARENA_H / 2 - PADDLE_H / 2,
    axis: 0,
  };
}

export function createGame(context: LaunchContext): GameState {
  const [a, b] = context.players;
  return {
    players: [makePlayer(a), makePlayer(b)],
    ball: { x: ARENA_W / 2 - BALL_SIZE / 2, y: ARENA_H / 2 - BALL_SIZE / 2, vx: 0, vy: 0 },
    phase: "attract",
    serveTimer: 0,
    serveDir: Math.random() < 0.5 ? 1 : -1,
    winner: null,
    goTimer: 0,
    ended: false,
    shake: 0,
    particles: [],
    trail: [],
    flashSide: -1,
    flashTimer: 0,
    events: [],
    acc: 0,
  };
}

function centerBall(state: GameState): void {
  state.ball.x = ARENA_W / 2 - BALL_SIZE / 2;
  state.ball.y = ARENA_H / 2 - BALL_SIZE / 2;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.trail.length = 0;
}

/** Launch the ball toward `state.serveDir` at a mild random angle. */
export function launchBall(state: GameState, angleOverride?: number): void {
  const angle = angleOverride ?? (Math.random() * 2 - 1) * ((35 * Math.PI) / 180);
  state.ball.vx = state.serveDir * BALL_START_SPEED * Math.cos(angle);
  state.ball.vy = BALL_START_SPEED * Math.sin(angle);
}

function spawnParticles(
  state: GameState,
  x: number,
  y: number,
  color: string,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * 220 + 60;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      color,
      size: Math.random() * 3 + 1.5,
      life: Math.random() * 180 + 160,
      maxLife: 340,
    });
  }
}

function ballSpeed(ball: Ball): number {
  return Math.hypot(ball.vx, ball.vy);
}

/** One fixed physics tick. Returns the index of the player who scored, or -1. */
export function stepFixed(state: GameState): -1 | 0 | 1 {
  const [left, right] = state.players;

  // Paddles always respond (so players can pre-position during the serve).
  left.paddleY = clamp(left.paddleY + left.axis * PADDLE_SPEED * FIXED_DT, 0, ARENA_H - PADDLE_H);
  right.paddleY = clamp(
    right.paddleY + right.axis * PADDLE_SPEED * FIXED_DT,
    0,
    ARENA_H - PADDLE_H,
  );

  if (state.phase !== "rally") return -1;

  const ball = state.ball;
  ball.x += ball.vx * FIXED_DT;
  ball.y += ball.vy * FIXED_DT;

  // Top / bottom walls.
  if (ball.y <= 0 && ball.vy < 0) {
    ball.y = 0;
    ball.vy = -ball.vy;
    state.events.push("wall");
    state.shake = Math.max(state.shake, 6);
  } else if (ball.y + BALL_SIZE >= ARENA_H && ball.vy > 0) {
    ball.y = ARENA_H - BALL_SIZE;
    ball.vy = -ball.vy;
    state.events.push("wall");
    state.shake = Math.max(state.shake, 6);
  }

  // Paddle collisions (only when moving toward the paddle).
  const leftFace = PADDLE_MARGIN + PADDLE_W;
  if (
    ball.vx < 0 &&
    ball.x <= leftFace &&
    ball.x + BALL_SIZE >= PADDLE_MARGIN &&
    ball.y + BALL_SIZE >= left.paddleY &&
    ball.y <= left.paddleY + PADDLE_H
  ) {
    bounceOffPaddle(state, left, 1);
    ball.x = leftFace;
  }

  const rightFace = ARENA_W - PADDLE_MARGIN - PADDLE_W;
  if (
    ball.vx > 0 &&
    ball.x + BALL_SIZE >= rightFace &&
    ball.x <= ARENA_W - PADDLE_MARGIN &&
    ball.y + BALL_SIZE >= right.paddleY &&
    ball.y <= right.paddleY + PADDLE_H
  ) {
    bounceOffPaddle(state, right, -1);
    ball.x = rightFace - BALL_SIZE;
  }

  // Scoring: ball fully past a side wall.
  if (ball.x + BALL_SIZE < 0) return 1; // right player scores
  if (ball.x > ARENA_W) return 0; // left player scores
  return -1;
}

function bounceOffPaddle(state: GameState, paddle: Player, dir: 1 | -1): void {
  const ball = state.ball;
  const ballCy = ball.y + BALL_SIZE / 2;
  const paddleCy = paddle.paddleY + PADDLE_H / 2;
  const rel = clamp((ballCy - paddleCy) / (PADDLE_H / 2), -1, 1);
  const bounce = rel * MAX_BOUNCE_RAD;
  const speed = Math.min(ballSpeed(ball) * BALL_SPEEDUP, BALL_MAX_SPEED);
  ball.vx = dir * speed * Math.cos(bounce);
  ball.vy = speed * Math.sin(bounce);
  state.events.push("paddle");
  state.shake = Math.max(state.shake, 4);
  const contactX = dir === 1 ? PADDLE_MARGIN + PADDLE_W : ARENA_W - PADDLE_MARGIN - PADDLE_W;
  spawnParticles(state, contactX, ballCy, paddle.color, 12);
}

/**
 * Frame-level update. Applies input, advances physics in fixed steps, handles
 * the state machine, and updates FX. Returns final standings exactly once (when
 * the match ends), otherwise null.
 */
export function advance(
  state: GameState,
  dtMs: number,
  p1: PlayerInput,
  p2: PlayerInput,
): PlayerStanding[] | null {
  const dt = Math.min(dtMs, 100); // clamp to avoid spiral of death
  state.players[0].axis = p1.axis;
  state.players[1].axis = p2.axis;

  updateFx(state, dt);

  switch (state.phase) {
    case "attract":
      if (p1.start || p2.start) startServe(state);
      break;
    case "serving":
      state.serveTimer -= dt;
      state.acc += dt;
      drainSteps(state); // paddles move; ball frozen
      if (state.serveTimer <= 0) {
        launchBall(state);
        state.phase = "rally";
      }
      break;
    case "rally": {
      state.acc += dt;
      const scorer = drainSteps(state);
      if (scorer === 0 || scorer === 1) return onScore(state, scorer);
      break;
    }
    case "gameover":
      state.goTimer -= dt;
      if (!state.ended && state.goTimer <= 0) {
        state.ended = true;
        return standingsFor(state);
      }
      break;
  }
  return null;
}

/** Drains the fixed-step accumulator. Returns the scorer index for this frame, or -1. */
function drainSteps(state: GameState): -1 | 0 | 1 {
  let scorer: -1 | 0 | 1 = -1;
  while (state.acc >= FIXED_MS) {
    state.acc -= FIXED_MS;
    const r = stepFixed(state);
    if (r >= 0) {
      scorer = r;
      state.acc = 0;
      break;
    }
  }
  return scorer;
}

function startServe(state: GameState): void {
  centerBall(state);
  state.serveTimer = SERVE_DELAY_MS;
  state.phase = "serving";
}

function onScore(state: GameState, scorer: 0 | 1): PlayerStanding[] | null {
  const winnerOfPoint = state.players[scorer];
  winnerOfPoint.score += 1;
  state.events.push("score");
  state.shake = Math.max(state.shake, 12);
  state.flashSide = scorer === 0 ? 1 : 0; // the wall that was just breached
  state.flashTimer = 520;
  spawnParticles(state, scorer === 0 ? ARENA_W : 0, ARENA_H / 2, winnerOfPoint.color, 26);

  if (winnerOfPoint.score >= WIN_SCORE) {
    state.winner = winnerOfPoint;
    state.phase = "gameover";
    state.goTimer = WIN_HOLD_MS;
    state.events.push("win");
    return null; // reported after the banner hold (see advance)
  }

  // Serve toward whoever was just scored on.
  state.serveDir = scorer === 0 ? -1 : 1;
  startServe(state);
  return null;
}

export function standingsFor(state: GameState): PlayerStanding[] {
  const [a, b] = state.players;
  const ranked = a.score >= b.score ? [a, b] : [b, a];
  return ranked.map((p, i) => ({
    slot: p.slot,
    profileId: p.profileId,
    rank: i + 1,
    score: p.score,
  }));
}

function updateFx(state: GameState, dt: number): void {
  state.shake = Math.max(0, state.shake - (SHAKE_DECAY * dt) / 1000);
  if (state.flashTimer > 0) state.flashTimer = Math.max(0, state.flashTimer - dt);
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.x += (p.vx * dt) / 1000;
    p.y += (p.vy * dt) / 1000;
    p.vy += (900 * dt) / 1000; // gravity
  }
  if (state.phase === "rally") {
    state.trail.push({ x: state.ball.x + BALL_SIZE / 2, y: state.ball.y + BALL_SIZE / 2 });
    while (state.trail.length > TRAIL_LEN) state.trail.shift();
  } else if (state.trail.length > 0) {
    state.trail.shift();
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
