import "./style.css";
import { createGameClient } from "@pfp/sdk";
import type { GameResult, LaunchContext, PlayerStanding } from "@pfp/sdk";
import { DirectInputReader } from "./input.js";

const GAME_ID = "__GAME_ID__";
const ROUND_MS = 45_000;
const PLAYER_SIZE = 28;

interface TemplatePlayer {
  slot: number;
  profileId: string | null;
  x: number;
  y: number;
  score: number;
  color: string;
  gamepadIndex: number;
}

interface TemplateState {
  players: TemplatePlayer[];
  elapsedMs: number;
  finished: boolean;
}

const client = createGameClient();
const input = new DirectInputReader();
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

if (!ctx) throw new Error("2D canvas context unavailable");

let launch: LaunchContext | null = null;
let state: TemplateState | null = null;
let startedAt = 0;
let last = 0;
let paused = false;
let reported = false;
let raf = 0;

client.onLaunch((context) => {
  launch = context;
  state = createState(context);
  startedAt = Date.now();
  last = performance.now();
  raf = requestAnimationFrame(loop);
});

client.onPause(() => {
  paused = true;
});

client.onResume(() => {
  paused = false;
  last = performance.now();
});

client.onTerminate(dispose);

window.addEventListener("error", (event) => client.reportError(event.message));
window.addEventListener("unhandledrejection", (event) => client.reportError(String(event.reason)));
window.addEventListener("resize", resize);
resize();

function createState(context: LaunchContext): TemplateState {
  const width = canvas.width || 1280;
  const height = canvas.height || 720;
  return {
    players: context.players.map((player, index) => ({
      slot: player.slot,
      profileId: player.profileId,
      x: width * (0.25 + index * 0.15),
      y: height * 0.5,
      score: 0,
      color: player.color,
      gamepadIndex: player.gamepadIndex,
    })),
    elapsedMs: 0,
    finished: false,
  };
}

function loop(now: number): void {
  raf = requestAnimationFrame(loop);
  if (!state || !launch) return;

  const dtMs = Math.min(50, now - last);
  last = now;

  if (!paused && !state.finished) {
    update(state, dtMs);
    if (state.finished && !reported) {
      reported = true;
      client.gameOver(toResult(launch, state));
    }
  }

  render(state);
}

function update(current: TemplateState, dtMs: number): void {
  const dt = dtMs / 1000;
  current.elapsedMs += dtMs;

  for (const player of current.players) {
    const controls = input.sample(player.gamepadIndex);
    player.x += controls.moveX * 260 * dt;
    player.y += controls.moveY * 260 * dt;
    player.x = clamp(player.x, PLAYER_SIZE, canvas.width - PLAYER_SIZE);
    player.y = clamp(player.y, PLAYER_SIZE, canvas.height - PLAYER_SIZE);
    if (controls.primary) player.score += dtMs / 1000;
  }

  current.finished = current.elapsedMs >= ROUND_MS;
}

function render(current: TemplateState): void {
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillText("__GAME_NAME__", 32, 48);
  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillText("Move with stick/D-pad or WASD. Hold A/Space to score.", 32, 78);

  const secondsLeft = Math.max(0, Math.ceil((ROUND_MS - current.elapsedMs) / 1000));
  ctx.fillText(`Time: ${secondsLeft}`, 32, 108);

  for (const player of current.players) {
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`P${player.slot + 1} ${Math.floor(player.score)}`, player.x, player.y - 38);
    ctx.textAlign = "start";
  }
}

function toResult(context: LaunchContext, current: TemplateState): GameResult {
  const standings = rankPlayers(current.players);
  return {
    gameId: GAME_ID,
    sessionId: context.sessionId,
    startedAt,
    endedAt: Date.now(),
    standings,
    gameStats: { durationMs: Date.now() - startedAt },
  };
}

function rankPlayers(players: TemplatePlayer[]): PlayerStanding[] {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return sorted.map((player, index) => ({
    slot: player.slot,
    profileId: player.profileId,
    rank: index + 1,
    score: Math.floor(player.score),
  }));
}

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dispose(): void {
  cancelAnimationFrame(raf);
  input.dispose();
  client.dispose();
}

client.ready();
