import "./style.css";
import { createGameClient, type LaunchContext, type PlayerStanding } from "@pfp/sdk";
import { advance, createGame } from "./game.js";
import { InputReader } from "./input/gamepad.js";
import { Renderer } from "./render/canvas.js";
import { computeStandings } from "./phases/score.js";
import type { GameState } from "./types.js";

const client = createGameClient();
const input = new InputReader();

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const renderer = new Renderer(ctx);

let launch: LaunchContext | null = null;
let state: GameState | null = null;
let paused = false;
let last = 0;
let raf = 0;
let reported = false;

client.onLaunch((c) => {
  launch = c;
  state = createGame(c);
  for (const p of c.players) input.bind(p.slot, p.gamepadIndex);
  last = performance.now();
  resize();
  raf = requestAnimationFrame(loop);
});
client.onPause(() => {
  paused = true;
  if (state) state.paused = true;
});
client.onResume(() => {
  paused = false;
  if (state) state.paused = false;
  last = performance.now();
});
client.onTerminate(() => {
  cancelAnimationFrame(raf);
  input.dispose();
  client.dispose();
});

window.addEventListener("error", (e) => client.reportError(e.message));
window.addEventListener("unhandledrejection", (e) => client.reportError(String(e.reason)));
window.addEventListener("resize", resize);

function resize(): void {
  renderer.resize(window.innerWidth, window.innerHeight);
}

function loop(now: number): void {
  raf = requestAnimationFrame(loop);
  if (!state || !launch) return;
  const dt = Math.min(50, now - last);
  last = now;

  if (!paused) {
    const frames = input.poll();
    const matchOver = advance(state, frames, dt);
    if (matchOver && !reported) {
      reported = true;
      const standings = computeStandings(state);
      const payload: PlayerStanding[] = standings.map(({ slot, rank }) => {
        const player = state!.players.find((p) => p.slot === slot)!;
        return {
          slot,
          profileId: player.profileId,
          rank,
          score: player.score.finalScore,
          stats: {
            finalScore: player.score.finalScore,
            roundsWon: player.score.roundsWon,
            finishes: player.score.finishes,
            deaths: player.score.deaths,
            coinsCollected: player.score.coinsCollected,
            diamondsCollected: player.score.diamondsCollected,
            killsCaused: player.score.killsCaused,
            loneSurvivor: player.score.loneSurvivor,
            trapsPlaced: player.score.trapsPlaced,
            selfKills: player.score.selfKills,
          },
        };
      });
      client.gameOver({
        gameId: "fowl-play",
        sessionId: launch.sessionId,
        startedAt: state.startedAt,
        endedAt: Date.now(),
        standings: payload,
        gameStats: {
          arenaIds: state.history.map((h) => h.arenaId),
          roundsPlayed: state.history.length,
          matchDurationMs: Date.now() - state.startedAt,
          winningScore: Math.max(...state.players.map((p) => p.score.finalScore)),
        },
      });
    }
  }

  renderer.draw(state);
}

client.ready();
