# Build Plan: Pong (`games/pong`)

> **Audience:** an implementer (human or AI) building the Pong game end to end.
> Follow these steps **in order**. Do not improvise architecture — every file
> path, constant, and contract call you need is written out below. When in
> doubt, copy how `games/raskulls` does it.

---

## 0. What you are building

A polished, juicy 2-player **Pong** that runs inside the PFP-FF shell as a
sandboxed iframe game. First player to **11 points** wins. It must:

- Speak the existing `@pfp/sdk` contract (no SDK changes allowed).
- Read Xbox controllers via the browser Gamepad API.
- Feel good: sound, screen shake, particles, a clean serve/score flow.
- Report a `GameResult` back to the shell when the match ends.

**Scope guardrails — do NOT do these:**

- ❌ Do not edit anything in `packages/sdk`, `packages/data`, `packages/input`,
  or `packages/ui`. The contract is fixed.
- ❌ Do not add Phaser or any game engine. Pong is a single `<canvas>` with the
  2D context. Keep dependencies to just `@pfp/sdk`.
- ❌ Do not add networking, accounts, or menus beyond what's described.
- ❌ Do not change other games or screens except the three small shell edits in
  Step 6.

If you finish the core and want to add more, see **Step 9 (stretch)** — but only
after the acceptance checklist in Step 8 passes.

---

## 1. The contract you must obey (read this once)

The shell launches your game in an iframe and talks to it through
`@pfp/sdk`. The lifecycle is always:

```
your game loads
  → client.ready()                    (you: "I'm loaded")
  → client.onLaunch((context) => …)   (shell: "here's who's playing")
  → …play the match…
  → client.gameOver(result)           (you: "here's who won")
  → shell shows results, returns to menu
```

Import and use the client exactly like this (this is the real, current API —
verified against `packages/sdk/src/client.ts`):

```ts
import { createGameClient } from "@pfp/sdk";
import type { LaunchContext, GameResult } from "@pfp/sdk";

const client = createGameClient(); // auto-connects to the parent shell window

client.onLaunch((context: LaunchContext) => {
  // context.players  → array of players who joined
  // context.sessionId → pass back unchanged in gameOver
  startMatch(context);
});

client.onTerminate(() => {
  // shell is force-closing us — stop the loop, clean up. Do NOT call gameOver.
  teardown();
});

client.onPause(() => { paused = true; });
client.onResume(() => { paused = false; });

client.ready(); // call LAST, after listeners are registered
```

`LaunchContext` and `PlayerSlot` (from `@pfp/sdk`):

```ts
interface LaunchContext {
  sessionId: string;
  sdkVersion: string;
  players: PlayerSlot[];
  settings: Record<string, unknown>; // ignore
}
interface PlayerSlot {
  slot: number;          // 0 = P1, 1 = P2 (NOT guaranteed contiguous — use the value, don't assume)
  profileId: string | null;
  displayName: string;   // "Ann" or "P1"
  color: string;         // hex, e.g. "#ef4444" — USE THIS as the paddle color
  gamepadIndex: number;  // navigator.getGamepads()[gamepadIndex]
}
```

The result you send back when the match ends:

```ts
client.gameOver({
  gameId: "pong",                    // MUST equal the id in games.ts
  sessionId: context.sessionId,      // unchanged from launch
  startedAt,                         // epoch ms when the first serve happened
  endedAt: Date.now(),
  standings: [
    { slot: winner.slot, profileId: winner.profileId, rank: 1, score: winnerScore },
    { slot: loser.slot,  profileId: loser.profileId,  rank: 2, score: loserScore  },
  ],
  gameStats: { durationMs: Date.now() - startedAt },
});
```

Rules: every player gets a standing; `rank` starts at 1 (winner); `score` is the
points they had. Pong is always exactly 2 players.

---

## 2. Reading controllers (Gamepad API)

The shell does **not** forward input. Poll the pad yourself each frame using the
player's `gamepadIndex`. Pong only needs vertical paddle movement.

```ts
// Returns -1 (up) … +1 (down), or 0 if no input.
function readPaddleAxis(gamepadIndex: number): number {
  const pad = navigator.getGamepads()[gamepadIndex];
  if (!pad) return 0;

  // Left stick Y is axes[1]; up is negative.
  let v = pad.axes[1] ?? 0;
  if (Math.abs(v) < 0.18) v = 0; // deadzone

  // D-pad fallback (buttons 12 = up, 13 = down).
  if (pad.buttons[12]?.pressed) v = -1;
  if (pad.buttons[13]?.pressed) v = 1;

  return Math.max(-1, Math.min(1, v));
}
```

**Keyboard fallback for dev** (so it's testable without controllers): P1 = `W`/`S`,
P2 = `↑`/`↓`. Track pressed keys in a `Set<string>` via `keydown`/`keyup`. When a
player's `gamepadIndex` has no pad connected, fall back to their keys. Wire this
so P1 = the player at index 0 of `context.players`, P2 = index 1.

Also read the **Start button** (`buttons[9]`) and `Enter` key to advance from the
"press start to serve" prompt and from the win screen.

---

## 3. Files to create

```
games/pong/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.ts          ← entry: creates client, canvas, game loop, lifecycle
    game.ts          ← pure-ish game state + step() update + physics
    render.ts        ← draws state to the 2D canvas (paddles, ball, score, FX)
    audio.ts         ← tiny WebAudio beep synth (no asset files)
    input.ts         ← readPaddleAxis + keyboard fallback + start-button read
    style.css        ← full-bleed black canvas
  test/
    game.test.ts     ← unit tests for physics/scoring (Vitest)
```

Mirror the Raskulls equivalents for boilerplate. Concrete contents below.

### `games/pong/package.json`

```json
{
  "name": "@pfp/pong",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5175",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0 --port 4175",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pfp/sdk": "workspace:*"
  }
}
```

### `games/pong/vite.config.ts`

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "/games/pong/",
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5175, strictPort: true },
});
```

### `games/pong/tsconfig.json`

Copy `games/raskulls/tsconfig.json` verbatim (it extends the base config).

### `games/pong/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pong</title>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### `games/pong/src/style.css`

```css
html, body { margin: 0; height: 100%; background: #05060a; overflow: hidden; }
#game { display: block; width: 100vw; height: 100vh; }
```

---

## 4. Game design — exact numbers

Work in a fixed **logical resolution of 1280×720**. Scale the canvas to the
window with `ctx.setTransform` (letterbox; keep aspect ratio). All constants
below are in logical units. **Use a fixed timestep** (accumulator) so physics is
deterministic and testable — do not multiply velocities by a variable `dt`.

```
ARENA_W = 1280, ARENA_H = 720
FIXED_DT = 1/120           // physics steps per second
PADDLE_W = 18, PADDLE_H = 120
PADDLE_MARGIN = 48         // distance of paddle face from each side wall
PADDLE_SPEED = 900         // units/sec
BALL_SIZE = 18
BALL_START_SPEED = 520
BALL_SPEEDUP = 1.04        // multiply speed on each paddle hit
BALL_MAX_SPEED = 1300
WIN_SCORE = 11
SERVE_DELAY_MS = 800       // pause after a point before the ball launches
```

### State machine

`attract` → `serving` → `rally` → (point scored) → `serving` → … → `gameover`

- **attract**: show "Press Start to begin". Wait for any player's Start/Enter.
- **serving**: ball centered, frozen, for `SERVE_DELAY_MS`. Show a 3·2·1 or just a
  brief countdown. Then launch toward the player who was just scored on (or a
  random side on first serve), at a mild random angle (within ±35° of horizontal).
- **rally**: simulate. Paddles move from input, clamped to the arena. Ball moves;
  bounces off top/bottom walls; bounces off paddles with angle based on where it
  hit the paddle (see below); if it passes a paddle's side, the other player scores.
- **gameover**: when someone reaches `WIN_SCORE`, freeze, show winner in their
  color, "Press Start to play again or B to quit". On Start → `gameover` resets to
  a fresh match (call `gameOver` to the shell first — see Step 5). On B
  (`buttons[1]`) → `client.requestExit()`.

### Paddle bounce angle

When the ball hits a paddle, reflect X velocity and set Y from the hit offset so
players can aim:

```ts
const rel = (ball.y - paddle.cy) / (PADDLE_H / 2); // -1 (top) … +1 (bottom)
const bounce = clamp(rel, -1, 1) * MAX_BOUNCE_RAD;  // MAX_BOUNCE_RAD = 50° in radians
let speed = min(currentSpeed * BALL_SPEEDUP, BALL_MAX_SPEED);
ball.vx = (hitLeftPaddle ? +1 : -1) * speed * cos(bounce);
ball.vy = speed * sin(bounce);
```

Nudge the ball just outside the paddle after a hit so it can't get stuck inside.

---

## 5. The lifecycle glue (`main.ts`)

Pseudocode for the entry point — fill in the real calls:

```ts
import "./style.css";
import { createGameClient } from "@pfp/sdk";
import type { LaunchContext } from "@pfp/sdk";
import { createGame, step } from "./game.js";
import { render } from "./render.js";

const client = createGameClient();
let ctx: LaunchContext | null = null;
let game = null;
let startedAt = 0;
let paused = false;
let raf = 0;

client.onLaunch((c) => {
  ctx = c;
  game = createGame(c);          // builds 2 players from c.players[0], c.players[1]
  startedAt = Date.now();
  loop(performance.now());
});
client.onPause(() => { paused = true; });
client.onResume(() => { paused = false; });
client.onTerminate(() => { cancelAnimationFrame(raf); /* dispose audio */ });

window.addEventListener("error", (e) => client.reportError(e.message));
window.addEventListener("unhandledrejection", (e) => client.reportError(String(e.reason)));

function loop(now: number) {
  raf = requestAnimationFrame(loop);
  if (!paused) {
    const finished = step(game, now);   // returns the winner standing array when match ends
    if (finished) {
      client.gameOver({
        gameId: "pong",
        sessionId: ctx!.sessionId,
        startedAt,
        endedAt: Date.now(),
        standings: finished,
        gameStats: { durationMs: Date.now() - startedAt },
      });
    }
  }
  render(game);
}

client.ready(); // last
```

> Note: after `gameOver`, the shell navigates away and may terminate the iframe;
> you do not need to keep running. The "play again" loop is optional polish — if
> you implement it, only call `gameOver` once per match, when WIN_SCORE is reached.

Use `games/raskulls/src/session.ts` and `src/main.ts` as the reference for the
exact import style (`.js` extensions in imports — this repo uses NodeNext
resolution, so **import paths end in `.js`** even though files are `.ts`).

---

## 6. Wire it into the shell (3 small edits)

**6a. `apps/shell/src/games.ts`** — a Pong entry already exists but uses a static
prod path. Make it dev-aware like Raskulls. At the top of the file Raskulls does:

```ts
const raskullsEntry = import.meta.env.DEV ? "http://localhost:5174/" : "/games/raskulls/index.html";
```

Add the same for Pong and use it in the Pong manifest entry:

```ts
const pongEntry = import.meta.env.DEV ? "http://localhost:5175/" : "/games/pong/index.html";
```

Then in the existing `pong` manifest object, set `entry: pongEntry` and bump
`version` to `"0.1.0"`. Add `statKeys` so the results/stats screens have labels:

```ts
statKeys: {
  score: { label: "Score", scope: "player" },
  durationMs: { label: "Duration", scope: "match" },
},
```

Leave `players: { min: 2, max: 2 }` and the existing `thumbnail` as-is.

**6b. `apps/shell/vite.config.ts`** — the `copyBuiltGames()` plugin is currently
hardcoded to copy only Raskulls. Generalize it to also copy Pong. Change the
plugin to loop over a list of game ids:

```ts
function copyBuiltGames(): Plugin {
  const games = ["raskulls", "pong"];
  return {
    name: "copy-built-games",
    closeBundle() {
      for (const id of games) {
        const source = fileURLToPath(new URL(`../../games/${id}/dist`, import.meta.url));
        const target = fileURLToPath(new URL(`./dist/games/${id}`, import.meta.url));
        if (!existsSync(source)) {
          throw new Error(`${id} build missing; run \`pnpm --filter @pfp/${id} build\` first.`);
        }
        rmSync(target, { recursive: true, force: true });
        mkdirSync(dirname(target), { recursive: true });
        cpSync(source, target, { recursive: true });
      }
    },
  };
}
```

**6c. Root `package.json`** — add Pong to the parallel `dev` script so its dev
server starts alongside the shell:

```
"dev": "pnpm -r --parallel --filter @pfp/shell --filter @pfp/raskulls --filter @pfp/pong dev",
```

The root `build` script already globs `./games/*`, so no build change is needed.

---

## 7. Juice (this is the point — do not skip)

A correct-but-silent Pong is exactly the "feels like a prototype" problem this
game is meant to fix. Budget real effort here.

- **Sound (`audio.ts`)** — synth with WebAudio, no asset files. Create one
  `AudioContext` (lazily, on first user gesture / first serve to satisfy autoplay
  policy). Make a `beep(freq, durationMs, type)` helper using an `OscillatorNode`
  + short gain envelope. Trigger:
  - wall bounce → short low square blip (~220 Hz, 40 ms)
  - paddle hit → brighter blip (~440 Hz, 50 ms), pitch up slightly as ball speeds up
  - score → descending two-tone for the player who got scored on
  - win → short rising arpeggio
- **Screen shake** — on paddle hits (tiny) and scores (bigger). Keep a `shake`
  magnitude that decays each frame; offset the canvas transform by a random
  vector scaled by `shake`.
- **Particles** — a small array of short-lived dots. Spawn a burst at the contact
  point on paddle hits (in the paddle's color) and a bigger burst at the goal line
  on a score. Update/fade them in the loop, draw in `render.ts`.
- **Ball trail** — store the last ~8 ball positions; draw them as fading rects so
  fast balls read clearly.
- **Center line** — dashed, dim. **Score** — large, top-center, each digit in that
  player's color. **Countdown** on serve.
- **Flash** — briefly flash the scored-on player's wall edge in their color.

Keep all FX cheap (no per-frame allocations in hot loops where avoidable). Target
a steady 60 fps.

---

## 8. Acceptance checklist (must all pass before "done")

Run from repo root unless noted.

- [ ] `pnpm --filter @pfp/pong typecheck` — no errors.
- [ ] `pnpm --filter @pfp/pong build` — produces `games/pong/dist/index.html`.
- [ ] `pnpm test` — existing 57 tests still pass **and** your new
      `games/pong/test/game.test.ts` passes.
- [ ] `pnpm build` (full) — succeeds; `apps/shell/dist/games/pong/` exists after.
- [ ] `pnpm dev`, open the shell (http://localhost:5173): Pong card appears, is
      selectable, launches into the iframe without console errors.
- [ ] You can play a full match with **keyboard** (W/S vs ↑/↓) to 11; the win
      screen shows the winner in their color.
- [ ] On match end the shell leaves the game and shows the **Results screen** with
      both players and their scores (this proves `gameOver` fired correctly).
- [ ] Stats screen shows a recorded Pong match afterward.
- [ ] Sound plays; screen shake + particles fire on hits and scores.
- [ ] No `postMessage` is sent by hand — all shell communication goes through the
      `@pfp/sdk` client.

### Required unit tests (`test/game.test.ts`)

Keep game logic pure enough to test without a canvas. Cover:

1. Ball reflects off the top wall (vy flips sign, y stays in bounds).
2. A ball that passes the left paddle's plane scores for the right player and
   increments their score by exactly 1.
3. Reaching `WIN_SCORE` transitions to `gameover` and produces a standings array
   with the higher-scoring player at `rank: 1`.
4. Paddle position clamps within `[0, ARENA_H - PADDLE_H]`.

---

## 9. Stretch (only after Step 8 passes)

- Best-of / first-to selector on the attract screen (3 / 7 / 11) via D-pad.
- Simple 1-player mode vs a tracking AI paddle (clamp AI speed so it's beatable),
  using only `context.players[0]` and a synthetic opponent — but note the manifest
  is `min: 2`, so leave the manifest as 2-player unless you also adjust it.
- Subtle CRT/scanline overlay to match the shell's retro texture.
- Speed-based color shift on the ball as it accelerates.

---

## 10. Reference files to imitate (don't reinvent)

| Need | Look at |
| --- | --- |
| SDK client method names/signatures | `packages/sdk/src/client.ts` |
| Contract types | `packages/sdk/src/types.ts` |
| Game entry + lifecycle wiring | `games/raskulls/src/main.ts`, `src/session.ts` |
| Vite/tsconfig/package conventions | `games/raskulls/{vite.config.ts,tsconfig.json,package.json}` |
| Reading pads / building input | `docs/ADDING_A_GAME.md` §5 |
| Full contract walkthrough | `docs/ADDING_A_GAME.md` |

**Golden rule:** if this plan and the code in `packages/sdk` ever disagree, the
code wins — read `packages/sdk/src/client.ts` and `types.ts` and follow those.
