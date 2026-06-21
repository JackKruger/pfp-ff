# Build Plan: Space Invaders (`games/space-invaders`)

> **Audience:** an implementer (human or AI) building the Space Invaders game end to end.
> Follow these steps **in order**. Do not improvise architecture — every file
> path, constant, and contract call you need is written out below. When in
> doubt, copy how `games/pong` does it.

---

## 0. What you are building

A polished, juicy **Space Invaders** cooperative game that runs inside the
PFP-FF shell as a sandboxed iframe game. **1–4 players** share a single screen,
each controlling a ship at the bottom, working together to destroy waves of
descending aliens.

It must:

- Speak the existing `@pfp/sdk` contract (no SDK changes allowed).
- Read Xbox controllers via the browser Gamepad API.
- Feel good: sound, screen shake, particles, a clean wave-transition flow.
- Report a `GameResult` back to the shell when the match ends.

**Scope guardrails — do NOT do these:**

- ❌ Do not edit anything in `packages/sdk`, `packages/data`, `packages/input`,
  or `packages/ui`. The contract is fixed.
- ❌ Do not add Phaser or any game engine. Space Invaders is a single `<canvas>`
  with the 2D context. Keep dependencies to just `@pfp/sdk`.
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
  → client.gameOver(result)           (you: "here's who won/placed")
  → shell shows results, returns to menu
```

Import and use the client exactly like Pong does (see `games/pong/src/main.ts`
for the reference).

`LaunchContext` gives you `players[]` (1–4 slots) with each slot having:
`slot`, `profileId`, `displayName`, `color`, `gamepadIndex`.

The result you send back:

```ts
client.gameOver({
  gameId: "space-invaders",
  sessionId: context.sessionId,
  startedAt,
  endedAt: Date.now(),
  standings: sortedPlayers.map((p, i) => ({
    slot: p.slot,
    profileId: p.profileId,
    rank: i + 1,    // 1 = highest score
    score: p.score,
    stats: {
      aliensKilled: p.aliensKilled,
      shotsFired: p.shotsFired,
      accuracy: p.accuracy,
      deaths: p.deaths,
    },
  })),
  gameStats: {
    waveReached: wave,
    totalAliensKilled: totalKilled,
    durationMs: Date.now() - startedAt,
    survived: allWavesCleared,
  },
});
```

Rules: every player gets a standing; `rank` starts at 1 (highest score); ties
share a rank. Since it's cooperative, the real "win" is surviving all waves,
but individual rankings are by score.

---

## 2. Reading controllers (Gamepad API)

Same as Pong — poll the pad each frame. Each player ship moves **horizontally**
(left/right) and has a **shoot** button (A / space).

```ts
function readShipInput(gamepadIndex: number, keyboardLeft: string, keyboardRight: string): ShipInput {
  const pad = navigator.getGamepads()[gamepadIndex] ?? null;
  let axis = 0;       // -1 left, +1 right
  let shoot = false;

  if (pad) {
    // Left stick X
    let stick = pad.axes[0] ?? 0;
    if (Math.abs(stick) < DEADZONE) stick = 0;
    if (stick !== 0) axis = stick;

    // D-pad
    if (pad.buttons[14]?.pressed) axis = -1;
    if (pad.buttons[15]?.pressed) axis = 1;

    // A button = shoot
    shoot = pad.buttons[0]?.pressed ?? false;
  }

  // Keyboard fallback
  if (keys.has(keyboardLeft)) axis = -1;
  if (keys.has(keyboardRight)) axis = 1;
  if (keys.has(" ")) shoot = true;

  return { axis: clamp(axis, -1, 1), shoot };
}
```

**Keyboard fallback for dev:**
- P1: A/D to move, Space to shoot, Enter to start
- P2: ←/→ arrows to move, Enter/numpad0 to shoot
- P3: numpad4/6 to move, numpadEnter to shoot
- P4: F/H to move, Tab to shoot

All players: Enter or any Start button to begin from attract screen.

Also read the **Start button** (`buttons[9]`) and B (`buttons[1]`) / Escape
for quitting after game over.

---

## 3. Files to create

```
games/space-invaders/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.ts          ← entry: creates client, canvas, game loop, lifecycle
    game.ts          ← pure-ish game state + step() update + physics
    render.ts        ← draws state to the 2D canvas (ships, aliens, bullets, shields, FX)
    audio.ts         ← WebAudio beep synth (no asset files)
    input.ts         ← ship input + keyboard fallback + start/back reads
    style.css        ← full-bleed black canvas
  test/
    game.test.ts     ← unit tests for physics/scoring (Vitest)
```

Mirror the Pong equivalents for boilerplate. Concrete contents below.

### `games/space-invaders/package.json`

```json
{
  "name": "@pfp/space-invaders",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5176",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0 --port 4176",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pfp/sdk": "workspace:*"
  }
}
```

### `games/space-invaders/vite.config.ts`

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "/games/space-invaders/",
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5176, strictPort: true },
});
```

### `games/space-invaders/tsconfig.json`

Copy `games/pong/tsconfig.json` verbatim (it extends the base config).

### `games/space-invaders/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Space Invaders</title>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### `games/space-invaders/src/style.css`

```css
html, body { margin: 0; height: 100%; background: #020617; overflow: hidden; }
#game { display: block; width: 100vw; height: 100vh; }
```

---

## 4. Game design — exact numbers

Work in a fixed **logical resolution of 960×720** (the original Space Invaders
aspect was taller/narrower; 960×720 fits nicely in a 16:9 screen with sidebars).
All constants below are in logical units. **Use a fixed timestep** (accumulator)
so physics is deterministic and testable.

```
ARENA_W = 960, ARENA_H = 720
FIXED_DT = 1/60            // physics steps per second

SHIP_W = 36, SHIP_H = 24
SHIP_Y = ARENA_H - 48      // pixel Y of the ship top
SHIP_SPEED = 380            // units/sec horizontal
SHIP_SHOOT_COOLDOWN = 350   // ms between shots per ship
SHIP_LIVES = 3
SHIP_RESPAWN_MS = 1200      // ms after death before respawn if lives remain
SHIP_INVINCIBLE_MS = 2000   // ms of invulnerability after respawn (blinking)

PLAYER_BULLET_W = 4, PLAYER_BULLET_H = 12
PLAYER_BULLET_SPEED = 600   // units/sec upward

ALIEN_BULLET_W = 4, ALIEN_BULLET_H = 10
ALIEN_BULLET_SPEED = 280    // units/sec downward

ALIEN_COLS = 11, ALIEN_ROWS = 5
ALIEN_W = 30, ALIEN_H = 24
ALIEN_GAP_X = 16, ALIEN_GAP_Y = 16
ALIEN_GRID_START_X = 80, ALIEN_GRID_START_Y = 60   // top-left of the whole grid

ALIEN_SPEED_BASE = 60       // px/sec horizontal (increases per wave)
ALIEN_DESCEND_AMOUNT = 20   // px dropped each time the grid hits a wall
ALIEN_SPEEDUP = 1.12         // multiplier per wave
ALIEN_SPEED_MAX = 300

ALIEN_SHOOT_INTERVAL_BASE = 900   // ms between shots (decreases per wave)
ALIEN_SHOOT_INTERVAL_MIN = 250

SHIELD_COUNT = 4
SHIELD_W = 80, SHIELD_H = 40
SHIELD_Y = SHIP_Y - 60      // Y position, above the ships
SHIELD_CELLS_X = 16, SHIELD_CELLS_Y = 8   // grid of hit cells per shield

SAUCER_POINTS = [50, 100, 150, 300]  // randomly chosen on spawn
SAUCER_INTERVAL_BASE = 25000  // ms between saucer spawns
SAUCER_SPEED = 120            // px/sec horizontal
SAUCER_W = 42, SAUCER_H = 20

WAVE_COUNT = 12              // total waves to clear (original was endless)
```

### State machine

`attract` → `playing` → (all players dead) → `gameover`
                     OR
           → (all waves cleared) → `victory` → `gameover`

- **attract**: Show "SPACE INVADERS", "Press Start to play", and controls info.
  Wait for any player's Start/Enter.
- **playing**: The main game. Players move and shoot. The alien grid moves
  left/right, descending periodically. When a wave is cleared or all players
  are dead, handle the transition:
  - **All aliens dead** → increment wave, show "WAVE N" for 2s, spawn next
    wave (faster aliens).
  - **All players dead with 0 lives** → game over.
  - **All waves cleared** → victory, show stats for 4s, then game over.
- **gameover**: Show results ("GAME OVER" or "VICTORY"), scores, and
  "Press Start to play again or B to quit". On Start → call `client.gameOver`
  and let the shell handle rematch. On B → `client.requestExit()`.

### Between-wave timing

When a wave is cleared:
1. Freeze gameplay (no movement, no shooting, no alien bullets).
2. Show "WAVE N" for 1800ms.
3. Spawn new alien grid with increased speed.
4. Respawning players start invincible.

### Alien movement algorithm (classic)

The entire grid moves as one unit:

```ts
// Each fixed step:
gridX += gridDir * alienSpeed * FIXED_DT;

// When any alien hits a wall:
if (gridLeftEdge <= 0 || gridRightEdge >= ARENA_W) {
  gridY += ALIEN_DESCEND_AMOUNT;
  gridDir *= -1;     // reverse direction
  // Speed up slightly when descending (classic behavior)
  alienSpeed *= 1.02;
}
```

If the grid descends below `SHIP_Y - 60` (the shield line), it's instant
game over — all players lose all remaining lives.

### Player bullets

- One bullet per player on screen at a time (simple, classic).
- Bullets travel straight up.
- On collision with an alien → alien dies, bullet destroyed, score +10 per
  row (row 0 = 50 pts, row 1 = 40, row 2 = 30, row 3 = 20, row 4 = 10, saucer = variable).
- On collision with a shield → bullet destroyed, shield cell destroyed.
- Bullet leaves screen top → removed.

### Alien bullets

- Random alien in the bottommost row of each column shoots at random intervals.
- Bullets travel straight down.
- On collision with a player ship (not invincible) → ship dies, lose a life.
- On collision with another player bullet → both destroyed (satisfying!).
- On collision with a shield → destroy the bullet and damage the shield.
- Leaves screen bottom → removed.

### Shields

- 4 shields evenly spaced across the bottom above the ships.
- Each shield is a grid of `SHIELD_CELLS_X × SHIELD_CELLS_Y` cells.
- A cell is destroyed when hit by any bullet (player or alien).
- Draw shields as pixelated blocks with missing cells.
- Shields persist across waves but get partially repaired (+40% of destroyed cells restored).

### Lives and death

- Each player starts with 3 lives.
- When a player is hit by an alien bullet (and not invincible):
  - Flash the ship in red, play an explosion sound, spawn particles.
  - Reduce lives by 1.
  - If lives > 0: respawn after `SHIP_RESPAWN_MS` with `SHIP_INVINCIBLE_MS` of invincibility (blinking).
  - If lives == 0: ship stays dead. Show a small skull/explosion at their position.
- When ALL players have 0 lives → game over.
- During respawn, the player's input is ignored and they can't shoot.
- Invincible ships are transparent (blink at ~8 Hz) and flash through bullets.

### Saucer (bonus UFO)

- Moves horizontally across the top of the screen at random intervals.
- Spawns on a random side, moves to the other side, then despawns.
- Worth a random amount: 50, 100, 150, or 300 points.
- One hit kills it (but it's narrow and moves fast).
- Rare — roughly every 25 seconds (with randomness).

---

## 5. The lifecycle glue (`main.ts`)

Follow the exact same pattern as Pong (`games/pong/src/main.ts`). Key differences:

```ts
import "./style.css";
import { createGameClient } from "@pfp/sdk";
import type { LaunchContext } from "@pfp/sdk";
import { advance, createGame, type GameState } from "./game.js";
import { render } from "./render.js";
import { InputReader } from "./input.js";
import { SIAudio } from "./audio.js";

const client = createGameClient();
const input = new InputReader();
const audio = new SIAudio();

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
  state = createGame(c);  // builds 1-4 players from context
  startedAt = Date.now();
  last = performance.now();
  raf = requestAnimationFrame(loop);
});
client.onPause(() => { paused = true; });
client.onResume(() => { paused = false; last = performance.now(); });
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
    if (frame.anyStart) audio.unlock();

    const standings = advance(state, dt, frame);

    if (state.events.length) {
      audio.playAll(state.events);
      state.events.length = 0;
    }

    if (standings && !reported) {
      reported = true;
      client.gameOver({
        gameId: "space-invaders",
        sessionId: ctxLaunch.sessionId,
        startedAt,
        endedAt: Date.now(),
        standings,
        gameStats: {
          waveReached: state.wave,
          totalAliensKilled: state.totalAliensKilled,
          durationMs: Date.now() - startedAt,
          survived: state.victory,
        },
      });
    }
  }

  render(ctx, state, canvas.width, canvas.height);
}

client.ready();
```

Use `games/pong/src/main.ts` as the reference. **Import paths end in `.js`**
(this repo uses NodeNext resolution).

---

## 6. Wire it into the shell (3 small edits)

**6a. `apps/shell/src/games.ts`** — add the Space Invaders entry:

```ts
const spaceInvadersEntry = import.meta.env.DEV
  ? "http://localhost:5176/"
  : "/games/space-invaders/index.html";
```

Add to the `GAMES` array (after pong, before stick-fight):

```ts
{
  id: "space-invaders",
  name: "Space Invaders",
  version: "0.1.0",
  engine: "web",
  entry: spaceInvadersEntry,
  players: { min: 1, max: 4 },
  sdk: "^1.0.0",
  tags: ["classic", "co-op", "arcade"],
  statKeys: {
    score: { label: "Score", scope: "player" },
    aliensKilled: { label: "Aliens Killed", scope: "player" },
    deaths: { label: "Deaths", scope: "player" },
    waveReached: { label: "Wave Reached", scope: "match" },
    totalAliensKilled: { label: "Total Aliens Killed", scope: "match" },
    durationMs: { label: "Duration", scope: "match" },
  },
},
```

Also add `space-invaders` to the thumbnail note (first, create a placeholder
thumb — a colorful 220×160 PNG with text "Space Invaders").

**6b. `apps/shell/vite.config.ts`** — add `"space-invaders"` to the `games` array:

```ts
const games = ["raskulls", "pong", "space-invaders"];
```

**6c. Root `package.json`** — add Space Invaders to the parallel `dev` script:

```
"dev": "pnpm -r --parallel --filter @pfp/shell --filter @pfp/raskulls --filter @pfp/pong --filter @pfp/space-invaders dev",
```

---

## 7. Juice (this is the point — do not skip)

- **Sound (`audio.ts`)** — same WebAudio approach as Pong. Sounds:
  - Player shoot → short rising blip (~600 Hz, 30ms)
  - Alien hit → mid-range explosion (~300 Hz, 80ms, noise-like with detuned oscillators)
  - Player hit → low thud + crash (~120 Hz, 150ms, sawtooth)
  - Shield hit → very short click (~800 Hz, 10ms)
  - Saucer → continuous warbling tone while on screen (oscillator with LFO FM)
  - Wave clear → ascending arpeggio (4 notes)
  - Game over → descending three-tone
  - Victory → rising fanfare (6 notes)
- **Screen shake** — on player death (heavy), alien death near bottom (light),
  alien grid hitting a wall (subtle tick).
- **Particles** — burst on alien death (green/white, 8-12 particles), big burst
  on player death (player's color, 20+ particles), sparks on shield hit.
- **Starfield background** — slowly scrolling starfield with ~80 stars at
  varying depths (parallax: slower stars = "farther away").
- **Alien animation** — two-frame animation that flips every ~400ms (classic
  Space Invaders look). Draw aliens as pixel-art style using rect fills.
- **Wave banner** — large "WAVE 3" text with a zoom-in/out pulse during the
  transition.
- **Lives display** — small ship icons in each player's color at the bottom
  left/right showing remaining lives.
- **Score display** — top-left shows each player's name (abbreviated) and score
  in their color.
- **Invincibility blink** — ship alpha oscillates between 1.0 and 0.2 at ~8 Hz.

Keep all FX cheap (no per-frame allocations in hot loops). Target a steady 60 fps.

---

## 8. Module design (`game.ts`)

This is the big one. The game state is a single object updated by `advance()`
using a **fixed-timestep accumulator**, same as Pong.

### Types

```ts
export type Phase = "attract" | "playing" | "wavetransition" | "gameover";
export type SoundKind = "shoot" | "alienHit" | "playerHit" | "shieldHit" | "saucerLoop" | "saucerHit" | "waveClear" | "gameOver" | "victory";

export interface ShipState {
  alive: boolean;
  slot: number;
  profileId: string | null;
  displayName: string;
  color: string;
  gamepadIndex: number;
  x: number;                  // center-x of the ship
  score: number;
  aliensKilled: number;
  shotsFired: number;
  deaths: number;
  lives: number;
  shootCooldown: number;      // ms remaining
  respawnTimer: number;       // ms remaining (0 = alive)
  invincibleTimer: number;    // ms remaining (0 = vulnerable)
  bullet: PlayerBullet | null;
}

export interface PlayerBullet {
  x: number;  // center
  y: number;  // top
}

export interface Alien {
  col: number;
  row: number;
  alive: boolean;
  x: number;  // center, computed from grid + offset
  y: number;
  frame: number;  // 0 or 1 for animation
}

export interface AlienBullet {
  x: number;
  y: number;
}

export interface ShieldCell {
  alive: boolean;
}

export interface Shield {
  x: number;       // top-left
  y: number;
  cells: boolean[][];  // [col][row]
}

export interface Saucer {
  x: number;
  y: number;
  dir: 1 | -1;
  points: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface Star {
  x: number;
  y: number;
  speed: number;    // px/sec
  size: number;
  brightness: number;
}

export interface GameState {
  players: ShipState[];
  aliens: Alien[][];          // [row][col]
  alienGridX: number;
  alienGridY: number;
  alienDir: 1 | -1;
  alienSpeed: number;
  alienShootTimer: number;
  alienBullets: AlienBullet[];
  shields: Shield[];
  saucer: Saucer | null;
  saucerTimer: number;
  wave: number;
  totalAliensKilled: number;
  phase: Phase;
  waveBannerTimer: number;
  goTimer: number;
  victory: boolean;
  ended: boolean;
  shake: number;
  particles: Particle[];
  stars: Star[];
  events: SoundKind[];
  acc: number;
  playerCount: number;
}
```

### Key functions

```ts
export function createGame(context: LaunchContext): GameState;
export function advance(
  state: GameState,
  dtMs: number,
  frame: InputFrame,
): PlayerStanding[] | null;
export function stepFixed(state: GameState): void;
```

`stepFixed` handles one fixed-timestep tick:
1. Move player bullets upward; check alien hits + shield hits + screen exit.
2. Move alien bullets downward; check player hits (skip invincible) + shield hits + screen exit.
3. Move the alien grid horizontally; check wall hit → descend + reverse.
4. Check if aliens reached the player zone → game over.
5. Fire alien bullets (random chance per column, only bottommost alive alien).
6. Move saucer; check player bullet hit.
7. Update saucer spawn timer.
8. Move/shoot is only active during `"playing"` phase.

`advance` handles per-frame:
1. Apply player inputs to ships.
2. Update respawn/invincible/cooldown timers.
3. Drain the fixed-step accumulator.
4. Handle phase transitions (playing → wavetransition → playing / gameover).
5. Update particles and stars.
6. When game ends, return `PlayerStanding[]` exactly once.

### Scoring

- Alien kills: row 0 (top) = 50, row 1 = 40, row 2 = 30, row 3 = 20, row 4 = 10.
- Saucer: random 50/100/150/300.
- Score is per-player; individual rank is by score.
- Ties share a rank.

### Wave setup

```ts
function spawnWave(state: GameState): void {
  state.wave++;
  state.alienSpeed = Math.min(
    ALIEN_SPEED_BASE * Math.pow(ALIEN_SPEEDUP, state.wave - 1),
    ALIEN_SPEED_MAX,
  );
  state.alienGridX = ALIEN_GRID_START_X;
  state.alienGridY = ALIEN_GRID_START_Y;
  state.alienDir = 1;

  for (let row = 0; row < ALIEN_ROWS; row++) {
    for (let col = 0; col < ALIEN_COLS; col++) {
      state.aliens[row][col] = {
        col, row,
        alive: true,
        x: state.alienGridX + col * (ALIEN_W + ALIEN_GAP_X) + ALIEN_W / 2,
        y: state.alienGridY + row * (ALIEN_H + ALIEN_GAP_Y) + ALIEN_H / 2,
        frame: 0,
      };
    }
  }

  // Repair shields slightly
  for (const shield of state.shields) {
    repairShield(shield, 0.4);
  }

  // Respawning players come back
  for (const p of state.players) {
    if (!p.alive && p.lives > 0) {
      respawn(p);
    }
  }
}
```

---

## 9. Acceptance checklist (must all pass before "done")

Run from repo root unless noted.

- [ ] `pnpm --filter @pfp/space-invaders typecheck` — no errors.
- [ ] `pnpm --filter @pfp/space-invaders build` — produces `games/space-invaders/dist/index.html`.
- [ ] `pnpm test` — existing tests still pass **and** your new
      `games/space-invaders/test/game.test.ts` passes.
- [ ] `pnpm build` (full) — succeeds; `apps/shell/dist/games/space-invaders/`
      exists after.
- [ ] `pnpm dev`, open the shell (http://localhost:5173): Space Invaders card
      appears, is selectable, launches into the iframe without console errors.
- [ ] You can play a full match with **keyboard** (A/D + Space for P1,
      arrows + Enter for P2) to game over; the results show.
- [ ] On match end the shell leaves the game and shows the **Results screen**
      with all players and their scores.
- [ ] Stats screen shows a recorded Space Invaders match afterward.
- [ ] Sound plays; screen shake + particles fire on hits and deaths.
- [ ] Aliens descend properly, speeds increase per wave.
- [ ] Shields work (degrade on hits, partially repair between waves).
- [ ] Players respawn after death (if lives remain).
- [ ] Saucer appears occasionally and gives bonus points.
- [ ] No `postMessage` is sent by hand — all shell communication goes through
      the `@pfp/sdk` client.

### Required unit tests (`test/game.test.ts`)

Keep game logic pure enough to test without a canvas. Cover:

1. A player ship moves left and right within the arena bounds.
2. A player bullet that hits an alien kills the alien and awards correct score
   (test both row 0 = 50pts and row 4 = 10pts).
3. A player bullet that hits a shield destroys the shield cell but not the
   whole shield.
4. An alien bullet that hits a player (not invincible) kills them and reduces
   lives by 1.
5. An alien bullet that hits an invincible player does nothing.
6. When all aliens are killed, the wave increments and new aliens spawn.
7. Alien grid descending below a threshold triggers game over.
8. A player with 0 lives does not respawn after death.
9. Players are ranked by score (highest score = rank 1).
10. The alien grid reverses direction and descends when hitting a wall.
11. A saucer hit awards the correct random point value.

---

## 10. Stretch (only after Step 8 passes)

- Power-up drops: occasionally a killed alien drops a power-up that drifts down:
  - Rapid fire (2s of no cooldown)
  - Shield restore
  - Extra life
  - Spread shot (3 bullets in a fan)
- Alien types with different behaviors:
  - Row 0: shielded (takes 2 hits)
  - Row 1-2: standard
  - Row 3-4: zigzag movement
- A boss alien every 4th wave (larger, takes many hits, shoots more).
- Difficulty selector on attract screen (Easy/Normal/Hard — affects alien speed
  and bullet frequency).
- CRT/scanline overlay to match the arcade feel.
- High score persistence across sessions (use `gameStats` and the stats screen).
- Alien dive-bomb attacks at low population (last ~5 aliens become aggressive).

---

## 11. Reference files to imitate (don't reinvent)

| Need | Look at |
| --- | --- |
| SDK client method names/signatures | `packages/sdk/src/client.ts` |
| Contract types | `packages/sdk/src/types.ts` |
| Game entry + lifecycle wiring | `games/pong/src/main.ts` |
| Fixed-timestep accumulator + test pattern | `games/pong/src/game.ts`, `games/pong/test/game.test.ts` |
| Canvas rendering (letterbox, FX) | `games/pong/src/render.ts` |
| WebAudio synth | `games/pong/src/audio.ts` |
| Input reading + keyboard fallback | `games/pong/src/input.ts` |
| Vite/tsconfig/package conventions | `games/pong/{vite.config.ts,tsconfig.json,package.json}` |
| Full contract walkthrough | `docs/ADDING_A_GAME.md` |

**Golden rule:** if this plan and the code in `packages/sdk` ever disagree, the
code wins — read `packages/sdk/src/client.ts` and `types.ts` and follow those.

---

## 12. Suggested implementation order

1. **Scaffold** the directory, `package.json`, `vite.config.ts`, `tsconfig.json`,
   `index.html`, `style.css` (copy from Pong, adapt names/ports).
2. **`game.ts` types + `createGame`** — define all interfaces, write
   `createGame()` that sets up 1–4 players, aliens, shields, starfield.
3. **`game.ts` physics + `stepFixed`** — alien grid movement, player bullet
   movement, collisions (alien-hit, shield-hit, player-hit), alien shooting,
   saucer logic.
4. **`game.ts` state machine + `advance`** — wire input into ships, drain
   accumulator, phase transitions, game-over detection, standings generation.
5. **`input.ts`** — Gamepad + keyboard reader for 1–4 players.
6. **`audio.ts`** — WebAudio synth for all sound effects.
7. **`render.ts`** — draw starfield, aliens, ships, bullets, shields, saucer,
   particles, HUD (score, lives), overlays (attract, wave banner, game over).
8. **`main.ts`** — wire everything together with the SDK lifecycle.
9. **`test/game.test.ts`** — unit tests.
10. **Shell integration** — edits to `games.ts`, `vite.config.ts`, `package.json`.
11. **Thumbnail** — 220×160 PNG placeholder for the game card.
12. **Juice polish** — sound balance, shake tuning, particle tweaks, starfield
    depth, alien animation frames.