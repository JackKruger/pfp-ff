import "./style.css";
import { createGameClient } from "@pfp/sdk";
import type { LaunchContext } from "@pfp/sdk";
import { advance, createGame, type GameState } from "./game.js";
import { render } from "./render.js";
import { InputReader } from "./input.js";
import { PongAudio } from "./audio.js";

const client = createGameClient();
const input = new InputReader();
const audio = new PongAudio();

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

let ctxLaunch: LaunchContext | null = null;
let state: GameState | null = null;
let startedAt = 0;
let last = 0;
let paused = false;
let reported = false;
let raf = 0;

client.onLaunch((c) => {
  ctxLaunch = c;
  state = createGame(c);
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
client.onTerminate(() => {
  cancelAnimationFrame(raf);
  input.dispose();
  client.dispose();
});

window.addEventListener("error", (e) => client.reportError(e.message));
window.addEventListener("unhandledrejection", (e) => client.reportError(String(e.reason)));

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}
window.addEventListener("resize", resize);
resize();

function loop(now: number): void {
  raf = requestAnimationFrame(loop);
  if (!state || !ctxLaunch) return;

  const dt = now - last;
  last = now;

  if (!paused) {
    const [p1Pad, p2Pad] = [ctxLaunch.players[0].gamepadIndex, ctxLaunch.players[1].gamepadIndex];
    const frame = input.sample(p1Pad, p2Pad);
    if (frame.p1.start || frame.p2.start) audio.unlock();

    const standings = advance(state, dt, frame.p1, frame.p2);

    if (state.events.length) {
      audio.playAll(state.events);
      state.events.length = 0;
    }

    if (standings && !reported) {
      reported = true;
      client.gameOver({
        gameId: "pong",
        sessionId: ctxLaunch.sessionId,
        startedAt,
        endedAt: Date.now(),
        standings,
        gameStats: { durationMs: Date.now() - startedAt },
      });
    }
  }

  render(ctx, state, canvas.width, canvas.height);
}

client.ready();
