import "./style.css";
import { createGameClient } from "@pfp/sdk";
import type { LaunchContext } from "@pfp/sdk";
import { advance, createGame, type GameState } from "./game.js";
import { render } from "./render.js";
import { InputReader } from "./input.js";
import { PartyAudio } from "./audio.js";

const client = createGameClient();
const input = new InputReader();
const audio = new PartyAudio();

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
    const frame = input.sample(ctxLaunch.players);
    if (frame.anyStart || frame.inputs.some((i) => i.a)) audio.unlock();

    const standings = advance(state, dt, frame);

    if (state.events.length) {
      audio.playAll(state.events);
      state.events.length = 0;
    }

    if (standings && !reported) {
      reported = true;
      client.gameOver({
        gameId: "party-mix",
        sessionId: ctxLaunch.sessionId,
        startedAt,
        endedAt: Date.now(),
        standings,
        gameStats: { rounds: state.round, durationMs: Date.now() - startedAt },
      });
    }
  }

  render(ctx, state, canvas.width, canvas.height);
}

client.ready();
