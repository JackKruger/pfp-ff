# Shell Architecture Implementation Plan

This plan describes how to evolve PFP-FF from a shell plus individually wired
games into a small platform with three clear layers:

1. A stable SDK protocol for lifecycle, launch context, results, and errors.
2. An optional shell-forwarded controls layer for games that do not want to poll
   browser devices directly.
3. A small first-party game kit that makes it cheap to create polished canvas
   games, especially AI-generated games.

The main constraint is backward compatibility. Current games that read the
Gamepad API directly must keep working. New platform features should be
additive, opt-in, and testable in small slices.

## Current Status

Completed:

- Phase 0 hardening: pause/resume lifecycle wiring, green typecheck, build runs
  typecheck, profile `lastPlayedAt` updates after matches, and current docs
  refreshed.
- Phase 1 manifest foundation: real games now have typed
  `games/*/game.manifest.ts` files, and the shell catalog consumes them while
  keeping placeholder games local.
- Phase 2 controls foundation: SDK `inputFrame` messages, `@pfp/controls`, and
  conditional shell control-forwarder lifecycle wiring are implemented.
- Phase 2 proof: Pong and Space Invaders are migrated to `hybrid` input (§4.4).
  Each consumes shell-forwarded frames via a `ForwardedInputReader` and falls
  back to its direct gamepad/keyboard reader when running standalone. Space
  Invaders also exercises a variable 1–4 player roster (mapped by slot), a held
  `shoot` action, and a global `anyStart` edge.

- Keyboard fallback in `@pfp/controls`: `KeyboardControlSource` feeds the
  control frame for any slot whose gamepad is disconnected (gamepad always
  wins), so `forwarded`/`hybrid` games stay dev-playable without a controller.
  The shell wires one in for every forwarded game.

Not yet done:

- Promoting Pong/Space Invaders from `hybrid` to `forwarded` once soaked.
- `@pfp/game-kit`.
- Starter templates and `scripts/create-game.mjs`.
- Manifest catalog generation to remove manual shell imports.

---

## 1. Target Architecture

### 1.1 Package Responsibilities

```text
packages/sdk
  Stable iframe protocol.
  Owns lifecycle, launch, pause/resume/terminate, gameOver, requestExit, error,
  version compatibility, and low-level message transport.

packages/input
  Browser device polling and pairing.
  Owns Gamepad API normalization, button edge detection, pairing lobby, and
  device-to-slot assignment.

packages/controls
  Optional shell-forwarded input runtime.
  Owns control frame types, action schemas, shell-side frame production, and
  game-side frame subscription helpers.

packages/game-kit
  Optional small-game runtime.
  Owns fixed timestep loops, canvas scaling, scene flow, input adapters,
  simple rendering helpers, audio unlock helpers, particles, collision helpers,
  and result builder helpers.

apps/shell
  Host app.
  Owns game library, profiles, pairing, settings, iframe launch, lifecycle UI,
  stats/results screens, persistence coordination, and shell-side control
  forwarding.

games/*
  Actual games.
  Can be fully custom and use only @pfp/sdk, or can use @pfp/controls and/or
  @pfp/game-kit for faster development.
```

### 1.2 Integration Modes

Every game should fit one of these modes:

```ts
type GameInputMode = "direct" | "forwarded" | "hybrid";
```

- `direct`: current behavior. The shell passes `gamepadIndex`; the game reads
  `navigator.getGamepads()` and owns keyboard fallback. This is best for custom
  engines, Phaser, Three.js, Godot, or games with unusual controls.
- `forwarded`: shell sends normalized input frames through the SDK channel. The
  game never reads browser devices directly. This is best for generated games,
  simple canvas games, and games that want consistent couch input behavior.
- `hybrid`: shell sends input frames, but the game may also read direct input.
  This is useful during migration or for advanced games that want shell-level
  actions plus engine-specific raw input.

The default for existing games should be `direct`. The default for new
`@pfp/game-kit` games should be `forwarded`.

### 1.3 Desired Game Author Experience

For a custom engine:

```ts
import { createGameClient } from "@pfp/sdk";

const client = createGameClient();

client.onLaunch((context) => startMyEngine(context));
client.onPause(() => pauseMyEngine());
client.onResume(() => resumeMyEngine());
client.onTerminate(() => destroyMyEngine());
client.ready();
```

For a shell-forwarded game:

```ts
import { createGameClient } from "@pfp/sdk";
import { createControlClient } from "@pfp/controls";

const client = createGameClient();
const controls = createControlClient(client);

controls.onFrame((frame) => {
  const p1 = frame.players[0];
  if (p1.actions.jump.justPressed) jump();
});
```

For a game-kit game:

```ts
import { defineGame } from "@pfp/game-kit";

export default defineGame({
  id: "my-game",
  logicalSize: { width: 1280, height: 720 },
  input: {
    actions: {
      move: ["leftStickX", "dpadX"],
      jump: ["a"],
      attack: ["x", "b"],
      pause: ["start"],
    },
  },
  create(ctx) {
    return {
      update(dt, input) {},
      render(gfx) {},
      getResult() {},
    };
  },
});
```

---

## 2. Phase 0 - Current Platform Hardening

Goal: make the current platform reliable before adding abstractions.

### 2.1 Wire Shell Pause/Resume To SDK

Current problem: the shell overlay changes local UI state, but games keep
running behind it. Games already have `client.onPause()` and
`client.onResume()` handlers.

Files:

- `apps/shell/src/screens/GameScreen.tsx`
- `apps/shell/test/`
- possibly `apps/shell/src/gameHostController.ts`

Tasks:

1. Extract small helpers inside `GameScreen`:

   ```ts
   function pauseGame() {
     hostRef.current?.pause();
     setPhase("overlay");
     setOverlayItem("resume");
   }

   function resumeGame() {
     hostRef.current?.resume();
     setPhase("playing");
   }
   ```

2. Replace all `setPhase("overlay")` pause paths with `pauseGame()`.
3. Replace all resume paths with `resumeGame()`.
4. On quit from overlay, send `host.terminate()` before navigating home if the
   iframe is still live. The cleanup effect already terminates, but explicit
   intent makes the behavior easier to reason about.
5. Keep load/error/dead-end states from sending pause/resume.

Testing:

- Add a unit-testable reducer/helper if direct React testing is too heavy.
- Cover these transitions:
  - `playing + Start -> overlay + host.pause()`
  - `overlay + Start -> playing + host.resume()`
  - `overlay + B -> playing + host.resume()`
  - `overlay + Resume click -> playing + host.resume()`
  - `overlay + Quit click -> navigate home + terminate/cleanup`

Acceptance criteria:

- Pong stops advancing while shell overlay is open.
- Space Invaders stops advancing while shell overlay is open.
- Resume does not produce a huge `dt` jump because game handlers reset timing.

### 2.2 Restore Green Typecheck

Current problem: `pnpm typecheck` fails in Party Mix tests.

Files:

- `games/party-mix/test/tiles.test.ts`

Tasks:

1. Fix the narrowing issue around `state.phase === "moving"` without weakening
   the test.
2. Preferred fix: move the loop condition behind a helper so TypeScript stops
   treating the local state as a literal:

   ```ts
   function isMoving(state: GameState): boolean {
     return state.phase === "moving";
   }
   ```

3. Re-run:

   ```bash
   pnpm --filter @pfp/party-mix typecheck
   pnpm typecheck
   pnpm test
   ```

Acceptance criteria:

- `pnpm typecheck` passes for all workspaces.
- Party Mix star tile tests still pass.

### 2.3 Make Build Confidence Match Typecheck Confidence

Current problem: root `pnpm build` can pass while `pnpm typecheck` fails because
most Vite builds transpile without typechecking.

Files:

- `package.json`
- `apps/shell/package.json`
- `games/*/package.json`

Tasks:

1. Decide on one policy:

   Preferred root policy:

   ```json
   {
     "scripts": {
       "build": "pnpm typecheck && pnpm -r --if-present --filter \"./packages/*\" build && pnpm -r --if-present --filter \"./games/*\" build && pnpm -r --if-present --filter \"./apps/*\" build"
     }
   }
   ```

   Alternative package policy:

   ```json
   {
     "scripts": {
       "build": "tsc && vite build"
     }
   }
   ```

2. Prefer the root policy first because all packages already expose
   `typecheck`, and some shared packages currently do not emit build artifacts.
3. If using package policy later, apply it to every Vite app/game for
   consistency.

Testing:

```bash
pnpm build
pnpm typecheck
```

Acceptance criteria:

- A type error fails the release build path.
- Current build still succeeds once Phase 0.2 is fixed.

### 2.4 Update Profile Recency On Match Record

Current problem: `Profile.lastPlayedAt` exists but match recording does not
update it.

Files:

- `apps/shell/src/store.ts`
- `packages/data/src/types.ts`
- `packages/data/test/`
- `apps/shell/test/`

Tasks:

1. In `recordMatch(result)`, gather unique non-null profile ids from
   `result.standings`.
2. For each id, call `dataStore.updateProfile(id, { lastPlayedAt: result.endedAt })`.
3. Update shell state with the returned profiles.
4. Decide failure behavior:
   - Match recording should remain best-effort at the GameScreen level.
   - If a profile update fails after match record succeeds, log it and keep the
     match. Do not block results navigation.
5. Consider whether `deleteProfile` should leave old match records intact. The
   current stats system handles missing profiles by showing ids/guests; keep
   that behavior for now.

Testing:

- Recording a match with one profile updates `lastPlayedAt`.
- Recording a match with two profiles updates both.
- Guest/null standings are ignored.
- Duplicate profile ids in one match update once.

Acceptance criteria:

- Recently played profiles can be sorted correctly later.
- Match records remain append-only.

### 2.5 Refresh Current Docs

Files:

- `README.md`
- `TODO.md`
- `docs/ARCHITECTURE.md`
- `docs/ADDING_A_GAME.md`

Tasks:

1. Update README status from planning to current implementation state.
2. List current playable games:
   - Raskulls
   - Pong
   - Space Invaders
   - Iron Yard
3. List parked/disabled games:
   - Party Mix
   - Stick Fight placeholder
4. Update `ADDING_A_GAME.md` with the current and future paths:
   - custom SDK-only game
   - shell-forwarded controls game
   - game-kit starter game
5. Link this implementation plan from `ARCHITECTURE.md`.

Acceptance criteria:

- A new contributor can tell what exists, what is planned, and what path to use
  for a new game.

---

## 3. Phase 1 - Manifest And Game Registry Cleanup

Goal: stop hardcoding the game catalog in the shell as the only source of truth.
The shell should consume game metadata, not manually define every field forever.

### 3.1 Extend Manifest Shape

Current `GameManifest` is a good base. Add platform metadata in an additive way.

Files:

- `packages/sdk/src/types.ts`
- `apps/shell/src/games.ts`
- new game manifest files

Proposed types:

```ts
export interface GameManifest {
  id: string;
  name: string;
  version: string;
  engine: "web" | "godot";
  entry: string;
  players: { min: number; max: number };
  thumbnail?: string;
  tags?: string[];
  sdk: string;
  statKeys?: Record<string, StatKeyDef>;
  achievements?: AchievementDef[];

  // new optional fields
  input?: GameInputManifest;
  settings?: GameSettingsManifest;
  presentation?: GamePresentationManifest;
  build?: GameBuildManifest;
}

export interface GameInputManifest {
  mode: "direct" | "forwarded" | "hybrid";
  actions?: Record<string, GameActionBinding[]>;
  tickHz?: number;
}

export interface GameActionBinding {
  source:
    | "leftStickX"
    | "leftStickY"
    | "rightStickX"
    | "rightStickY"
    | "dpadX"
    | "dpadY"
    | "a"
    | "b"
    | "x"
    | "y"
    | "lb"
    | "rb"
    | "lt"
    | "rt"
    | "start"
    | "back";
  scale?: number;
  deadzone?: number;
}

export interface GameSettingsManifest {
  fields: GameSettingDef[];
}

export type GameSettingDef =
  | { id: string; label: string; type: "boolean"; default: boolean }
  | {
      id: string;
      label: string;
      type: "number";
      min: number;
      max: number;
      step?: number;
      default: number;
    }
  | {
      id: string;
      label: string;
      type: "choice";
      options: { value: string; label: string }[];
      default: string;
    };

export interface GamePresentationManifest {
  category?: "racing" | "classic" | "fighting" | "party";
  accent?: string;
  icon?: string;
  blurb?: string;
  heroArt?: string;
  featured?: boolean;
  disabled?: boolean;
}

export interface GameBuildManifest {
  packageName?: string;
  devPort?: number;
  built?: boolean;
}
```

Important: keep shell-only metadata either under `presentation`/`build`, or
keep a shell-local extension type. Avoid mixing one-off shell UI concerns into
the protocol fields used by external games.

### 3.2 Add Per-Game Manifest Files

Preferred file path:

```text
games/pong/game.manifest.ts
games/raskulls/game.manifest.ts
games/space-invaders/game.manifest.ts
games/iron-yard/game.manifest.ts
games/party-mix/game.manifest.ts
```

Use TypeScript instead of JSON at first because:

- It gives compile-time type checking.
- Dev and production entries can still be derived cleanly.
- Existing shell assets and constants can remain typed.

Example:

```ts
import type { GameManifest } from "@pfp/sdk";

const manifest = {
  id: "pong",
  name: "Pong",
  version: "0.1.0",
  engine: "web",
  entry: "/games/pong/index.html",
  players: { min: 2, max: 2 },
  sdk: "^1.0.0",
  input: { mode: "direct" },
  presentation: {
    category: "classic",
    accent: "#4f9dff",
    thumbnail: "/thumbnails/pong.png",
    icon: "PONG",
    blurb: "The original duel.",
  },
} satisfies GameManifest;

export default manifest;
```

### 3.3 Generate Shell Catalog

Files:

- `scripts/generate-game-catalog.mjs`
- `apps/shell/src/games.generated.ts`
- `apps/shell/src/games.ts`

Tasks:

1. Create a script that scans `games/*/game.manifest.ts`.
2. For the first pass, a simple explicit import file is acceptable:

   ```ts
   import pong from "../../../games/pong/game.manifest";
   export const GAME_MANIFESTS = [pong];
   ```

3. Later, automate generation so adding a game does not require editing the
   shell manually.
4. Keep `apps/shell/src/games.ts` as the place that maps manifest metadata to
   shell presentation view models.

Testing:

- Existing `playableGamesMissingBuild` test should keep passing.
- Add a test that every game id is unique.
- Add a test that enabled games have thumbnails and production entries.

Acceptance criteria:

- A new game can be registered by adding a manifest and build metadata.
- Shell UI still renders the same library.

### 3.4 Settings Handshake

Current launch settings are always `{}`. Add shell support before games depend
on it.

Files:

- `apps/shell/src/screens/PairingScreen.tsx`
- possibly `apps/shell/src/screens/GameSettingsScreen.tsx`
- `apps/shell/src/store.ts`
- `packages/sdk/src/types.ts`

Tasks:

1. Add `selectedGameSettings: Record<string, unknown>` to shell state.
2. If a manifest has settings fields, show them between game selection and
   pairing, or as a compact panel on the pairing screen.
3. Validate settings from the manifest before launch.
4. Pass settings into `host.launch({ settings })`.

Initial settings to prove the path:

- Iron Yard:
  - `botDifficulty`: easy/medium/hard
  - `scoreToWin`: number
- Raskulls:
  - `mode`: race/grandPrix/challenge
  - `bots`: boolean or count

Acceptance criteria:

- At least one game reads a shell-selected setting.
- Invalid settings cannot be sent.

---

## 4. Phase 2 - Shell-Forwarded Controls

Goal: support games that receive normalized input frames from the shell instead
of polling devices directly.

### 4.1 Add Protocol Message Types

The control stream still rides over the SDK transport. That keeps one iframe
bridge and one lifecycle model.

Files:

- `packages/sdk/src/protocol.ts`
- `packages/sdk/src/types.ts`
- `packages/sdk/src/host.ts`
- `packages/sdk/src/client.ts`
- `packages/sdk/test/handshake.test.ts`

Add messages:

```ts
export const ShellToGame = {
  // existing
  LAUNCH: "launch",
  PAUSE: "pause",
  RESUME: "resume",
  TERMINATE: "terminate",

  // new
  INPUT_FRAME: "inputFrame",
} as const;
```

Add payload type:

```ts
export interface ControlFrame {
  seq: number;
  now: number;
  dtMs: number;
  paused: boolean;
  players: ControlPlayerFrame[];
}

export interface ControlPlayerFrame {
  slot: number;
  profileId: string | null;
  connected: boolean;
  source: "gamepad" | "keyboard" | "ai" | "none";
  axes: {
    moveX: number;
    moveY: number;
    aimX: number;
    aimY: number;
    throttle?: number;
  };
  buttons: Record<ControlButton, ControlButtonState>;
  actions: Record<string, ControlActionState>;
}

export type ControlButton =
  | "a"
  | "b"
  | "x"
  | "y"
  | "lb"
  | "rb"
  | "lt"
  | "rt"
  | "start"
  | "back"
  | "up"
  | "down"
  | "left"
  | "right";

export interface ControlButtonState {
  pressed: boolean;
  justPressed: boolean;
  justReleased: boolean;
  value: number;
}

export interface ControlActionState extends ControlButtonState {
  x?: number;
  y?: number;
}
```

Host API:

```ts
interface GameHost {
  sendInputFrame(frame: ControlFrame): void;
}
```

Client API can stay low-level:

```ts
interface GameClient {
  onInputFrame(callback: (frame: ControlFrame) => void): () => void;
}
```

Then `@pfp/controls` wraps this with nicer helpers.

Testing:

- Linked transport test sends an input frame host -> client.
- Disposing client/host clears input listeners.
- Existing SDK handshake tests still pass.

Acceptance criteria:

- Input frame messages are additive and do not affect direct-input games.

### 4.2 Create `@pfp/controls`

Files:

```text
packages/controls/package.json
packages/controls/tsconfig.json
packages/controls/src/index.ts
packages/controls/src/schema.ts
packages/controls/src/frame.ts
packages/controls/src/shell.ts
packages/controls/src/client.ts
packages/controls/test/*.test.ts
```

Responsibilities:

- Define action schemas.
- Convert `@pfp/input` normalized gamepad states into `ControlFrame`.
- Provide shell-side forwarder.
- Provide game-side frame cache/subscription helpers.
- Provide test utilities for synthetic input.

Core APIs:

```ts
export interface ControlSchema {
  actions: Record<string, ActionBinding>;
}

export type ActionBinding =
  | { kind: "button"; button: ControlButton }
  | { kind: "axis1d"; negative?: ControlSource; positive?: ControlSource; axis?: ControlSource }
  | { kind: "axis2d"; x: ActionBinding; y: ActionBinding };

export function createControlForwarder(options: {
  host: GameHost;
  poller: GamepadPoller;
  players: PlayerSlot[];
  schema: ControlSchema;
  keyboard?: KeyboardControlSource;
  clock?: () => number;
}): ControlForwarder;

export interface ControlForwarder {
  start(): void;
  stop(): void;
  setPaused(paused: boolean): void;
  updatePlayers(players: PlayerSlot[]): void;
  dispose(): void;
}

export function createControlClient(client: GameClient): ControlClient;

export interface ControlClient {
  getLatestFrame(): ControlFrame | null;
  onFrame(callback: (frame: ControlFrame) => void): () => void;
  isPressed(slot: number, action: string): boolean;
  justPressed(slot: number, action: string): boolean;
  axis(slot: number, action: string): number;
}
```

Implementation details:

- Frame production should run on the shell ticker.
- The shell should send the latest frame only; no backlog.
- `seq` increments once per sent frame.
- `dtMs` should be capped, for example at `100`, to avoid huge jumps.
- When shell overlay is paused, either stop forwarding or forward frames with
  `paused: true`. Prefer forwarding `paused: true` at a low rate only if games
  need menu input; otherwise stop.
- Edge detection should come from the shell's `GamepadPoller` where possible,
  not reimplemented per game.

Testing:

- Gamepad button press maps to action `justPressed` for one frame.
- Axis deadzone works.
- Player slots preserve shell slot ids.
- Keyboard synthetic slots produce frames.
- `dispose()` stops sending frames.

Acceptance criteria:

- A test game can move using only forwarded frames.
- Existing direct-input games are unchanged.

### 4.3 Shell Integration

Files:

- `apps/shell/src/screens/GameScreen.tsx`
- `apps/shell/src/games.ts`
- `apps/shell/test/`

Tasks:

1. On game launch, inspect `selectedGame.input?.mode`.
2. If mode is `forwarded` or `hybrid`, create a `ControlForwarder` after
   `host.launch()`.
3. Start forwarding when the game enters `playing`.
4. Pause/stop forwarding when shell overlay opens.
5. Resume forwarding when shell overlay closes.
6. Dispose forwarder on game over, request exit, error, incompatible SDK, or
   unmount.

Pseudo-flow:

```ts
host.onReady(() => {
  const players = buildPlayers();
  host.launch({ ...context, players });

  if (usesForwardedInput(game)) {
    forwarderRef.current = createControlForwarder({
      host,
      poller: ticker.poller,
      players,
      schema: schemaFromManifest(game.input),
    });
    forwarderRef.current.start();
  }

  setPhase("playing");
});
```

Testing:

- Forwarder starts only for forwarded/hybrid games.
- Forwarder stops on cleanup.
- Pause overlay pauses forwarder and sends SDK pause.
- Resume restarts forwarder and sends SDK resume.

Acceptance criteria:

- Shell can launch a forwarded-input sample game.
- No control frames are sent to direct-only games.

### 4.4 Migrate One Simple Game To Prove It

Candidate: Pong.

Reason:

- Smallest input surface.
- Existing tests cover behavior.
- Easy to compare before/after.

Plan:

1. [x] Add `input.mode: "hybrid"` to Pong manifest, with `paddle`/`start`/`back`
   action bindings.
2. [x] Add a `ForwardedInputReader` (`games/pong/src/forwardedInput.ts`) that
   reads the latest `ControlFrame` and produces Pong's `InputFrame` shape.
3. [x] Keep direct `InputReader` as a standalone-dev fallback.
4. [x] Use forwarded frames when available (`forwarded.sample() ?? input.sample(...)`).
5. After stable, switch Pong to `forwarded`.

Acceptance criteria:

- Pong works with forwarded controls.
- Pong still works standalone or in a direct-input dev mode if needed.

---

## 5. Phase 3 - `@pfp/game-kit`

Goal: create a small engine for fast first-party and AI-generated games without
restricting custom games.

### 5.1 Scope

This should not try to become Phaser, Unity, Godot, or Three.js. It should be a
thin runtime for the kind of games the project is likely to generate often:

- Pong-like arcade games
- Space Invaders-like shooters
- local party minigames
- tile/grid games
- simple platformers
- simple arena games

Out of scope:

- 3D rendering
- skeletal animation
- general physics engine
- map editor
- online multiplayer
- asset pipeline beyond simple image/audio loading

### 5.2 Package Skeleton

Files:

```text
packages/game-kit/package.json
packages/game-kit/tsconfig.json
packages/game-kit/src/index.ts
packages/game-kit/src/runtime.ts
packages/game-kit/src/canvas.ts
packages/game-kit/src/scenes.ts
packages/game-kit/src/assets.ts
packages/game-kit/src/audio.ts
packages/game-kit/src/collision.ts
packages/game-kit/src/math.ts
packages/game-kit/src/particles.ts
packages/game-kit/src/results.ts
packages/game-kit/src/testing.ts
packages/game-kit/test/*.test.ts
```

Package dependencies:

- `@pfp/sdk`
- `@pfp/controls`

No React dependency. No shell dependency.

### 5.3 Runtime API

```ts
export interface GameDefinition<TState = unknown> {
  id: string;
  logicalSize: Size;
  input?: ControlSchema;
  create(context: KitGameContext): KitGame<TState>;
}

export interface KitGameContext {
  launch: LaunchContext;
  canvas: HTMLCanvasElement;
  audio: KitAudio;
  assets: AssetStore;
  random: Random;
}

export interface KitGame<TState = unknown> {
  state?: TState;
  update(dt: number, input: ControlFrame): void;
  render(gfx: KitGraphics): void;
  onPause?(): void;
  onResume?(): void;
  onTerminate?(): void;
  isFinished?(): boolean;
  getResult?(): GameResult;
}

export function runGame(definition: GameDefinition): void;
```

`runGame()` should:

1. Create SDK client.
2. Create controls client.
3. Wait for launch.
4. Set up canvas and scaling.
5. Start a fixed timestep loop.
6. Pause/resume from SDK lifecycle.
7. Call `client.gameOver()` once when result is available.
8. Dispose event listeners on terminate.

### 5.4 Fixed Timestep

Requirements:

- Deterministic update loop.
- Render interpolation optional.
- Cap accumulated time to avoid spiral of death.
- Pause resets timestamps.

API:

```ts
export interface FixedStepOptions {
  stepMs: number; // default 1000 / 60
  maxAccumulatedMs: number; // default 250
}

export class FixedStepLoop {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
}
```

Testing:

- Given simulated time, update fires expected number of times.
- Pause prevents updates.
- Resume avoids one huge update.

### 5.5 Canvas And Graphics

Provide predictable scaling:

```ts
export interface CanvasViewport {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function fitCanvasToWindow(canvas: HTMLCanvasElement, logical: Size): CanvasViewport;
```

`KitGraphics` can wrap a 2D context:

```ts
export interface KitGraphics {
  ctx: CanvasRenderingContext2D;
  viewport: CanvasViewport;
  clear(color: string): void;
  shake(amount: number): void;
  drawText(text: string, options: TextOptions): void;
  drawSprite(sprite: Sprite, x: number, y: number, options?: SpriteOptions): void;
  drawBar(x: number, y: number, w: number, h: number, value: number, options?: BarOptions): void;
}
```

Keep this intentionally small. Games can always access raw `ctx`.

### 5.6 Assets

Requirements:

- Load images and audio by key.
- Report loading progress.
- Fall back gracefully if assets are absent.
- Keep generated games playable with code-drawn primitives.

API:

```ts
export function defineAssets(assets: {
  images?: Record<string, string>;
  audio?: Record<string, string>;
}): AssetManifest;

export class AssetStore {
  load(manifest: AssetManifest): Promise<void>;
  image(key: string): HTMLImageElement | null;
  audio(key: string): AudioBuffer | null;
}
```

### 5.7 Audio

Requirements:

- Handle browser audio unlock.
- Provide simple synth sounds for generated games.
- Keep direct WebAudio available for custom games.

API:

```ts
export class KitAudio {
  unlock(): Promise<void>;
  beep(options: BeepOptions): void;
  noise(options: NoiseOptions): void;
  playBuffer(key: string, options?: PlayOptions): void;
  setMuted(muted: boolean): void;
}
```

### 5.8 Collision And Math

Start with simple helpers:

```ts
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean;
export function circleRectOverlap(circle: Circle, rect: Rect): boolean;
export function clamp(value: number, min: number, max: number): number;
export function lerp(a: number, b: number, t: number): number;
export function rankByScore(players: PlayerScore[], options?: RankOptions): PlayerStanding[];
```

### 5.9 Result Builder

Result creation is easy to get subtly wrong. Centralize it.

```ts
export function createResultBuilder(options: {
  gameId: string;
  launch: LaunchContext;
  startedAt: number;
}): ResultBuilder;

export interface ResultBuilder {
  standingsFromScores(
    scores: { slot: number; score: number; stats?: Record<string, number> }[],
  ): PlayerStanding[];
  gameOver(input: {
    standings: PlayerStanding[];
    gameStats?: Record<string, unknown>;
    endedAt?: number;
  }): GameResult;
}
```

Testing:

- Ties share rank.
- Every launched player can be represented.
- Missing profile ids use launch context.

### 5.10 Testing Utilities

Generated games need easy tests.

API:

```ts
export function makeLaunchContext(players: number): LaunchContext;
export function makeControlFrame(input: Partial<TestControlFrame>): ControlFrame;
export function stepGame(game: KitGame, frames: ControlFrame[], stepMs?: number): void;
```

Acceptance criteria:

- A new game can unit-test its logic without DOM or iframes.

---

## 6. Phase 4 - Starter Templates

Goal: make the desired architecture the easiest path for humans and AI agents.

### 6.1 Add A Game-Kit Template

Files:

```text
games/_template-game-kit/
  game.manifest.ts
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/main.ts
  src/game.ts
  src/style.css
  test/game.test.ts
```

Template requirements:

- Uses `@pfp/game-kit`.
- Uses forwarded controls.
- Has a simple title/countdown/playing/results loop.
- Has one or two players by default.
- Has tests.
- Builds with `pnpm build`.
- Typechecks with `pnpm typecheck`.

### 6.2 Add A Custom SDK Template

Files:

```text
games/_template-sdk/
```

Purpose:

- For Phaser, Three.js, Godot exports, or unusual engines.
- Shows raw SDK lifecycle only.
- Shows direct gamepad polling and terminate cleanup.

### 6.3 Add A Game Creation Checklist

Update:

- `docs/ADDING_A_GAME.md`

Checklist:

1. Pick integration mode: SDK-only, forwarded controls, or game-kit.
2. Create manifest.
3. Add package scripts.
4. Add tests.
5. Add thumbnail/hero art or generated placeholder.
6. Verify direct launch.
7. Verify shell launch.
8. Verify pause/resume.
9. Verify game over result.
10. Verify production build copy.

---

## 7. Phase 5 - AI-Generated Game Workflow

Goal: make generated games consistent enough that they can be reviewed and
maintained.

### 7.1 Define A Game Spec Format

Create a simple spec format that an AI agent can fill in before implementation.

File:

```text
docs/GAME_SPEC_TEMPLATE.md
```

Sections:

- Game name and one-line concept.
- Player count.
- Camera/view.
- Controls.
- Core loop.
- Win/loss conditions.
- Scoring.
- Entities.
- Collision rules.
- Audio/visual style.
- Required stats.
- Test cases.
- Out-of-scope items.

### 7.2 Build A Generator Script

Files:

```text
scripts/create-game.mjs
```

Initial command:

```bash
pnpm create-game my-game --template game-kit
```

Tasks:

1. Copy template.
2. Rename package.
3. Fill manifest id/name.
4. Pick dev port.
5. Add thumbnail placeholder.
6. Optionally update generated catalog.

Acceptance criteria:

- A new blank game can be created and launched in the shell in under a minute.

### 7.3 Add Generated-Game Quality Gates

Required for AI-generated games:

- No direct edits to `packages/sdk` unless explicitly requested.
- Must use `@pfp/game-kit` unless custom engine is justified.
- Must include logic tests.
- Must report `GameResult`.
- Must respond to pause/resume/terminate.
- Must run in shell iframe.
- Must not require network.
- Must not use unlicensed copied assets.

---

## 8. Phase 6 - Shell Runtime Improvements

Goal: make the shell feel like a console host rather than just a page router.

### 8.1 Dedicated Game Host Controller

Extract iframe/lifecycle logic from `GameScreen`.

Files:

```text
apps/shell/src/host/GameHostController.ts
apps/shell/src/host/types.ts
apps/shell/src/host/useGameHost.ts
```

Responsibilities:

- Create/dispose SDK host.
- Manage iframe `src`.
- Track phase: loading, playing, paused, error, done.
- Handle load timeout.
- Launch context creation.
- Settings validation.
- Control forwarder lifecycle.
- Result persistence callback.

React screen should become mostly presentation.

Acceptance criteria:

- Game host lifecycle can be unit tested without rendering the whole screen.

### 8.2 Better Error Model

Add structured host errors:

```ts
type GameLaunchError =
  | { kind: "load-timeout"; gameId: string }
  | { kind: "sdk-incompatible"; gameId: string; gameSdkRange: string; hostVersion: string }
  | { kind: "game-error"; gameId: string; message: string }
  | { kind: "persistence-error"; gameId: string; error: unknown };
```

UI should show:

- friendly message
- game id
- retry
- back to menu
- optional details in dev mode

### 8.3 Controller Disconnect Handling

Current pairing works before launch, but in-game disconnect handling should be a
shell capability.

Tasks:

1. Track connected controller indices during a match.
2. If a required player controller disconnects:
   - send `pause`
   - show reconnect overlay
   - resume when controller returns or player chooses continue
3. For forwarded-input games, disconnected players receive `connected: false`.
4. For direct-input games, the shell still pauses so the game does not continue
   with missing input.

### 8.4 Global Shell Overlay

Eventually centralize in-game shell UI:

- Pause/resume
- Quit
- Controller disconnected
- Screenshot/capture later
- Settings if safe to adjust mid-game

This overlay should own shell actions only. It should not try to be a universal
in-game menu.

---

## 9. Phase 7 - Data And Stats Improvements

Goal: make the platform's long-term data useful as more games arrive.

### 9.1 Result Validation

Before recording a result, validate:

- `gameId` matches selected game.
- `sessionId` matches launch session.
- Every launched player has one standing.
- No unknown slot appears.
- `rank` starts at 1.
- Scores are finite numbers when present.
- Per-player stats are finite numbers.

Files:

- `packages/sdk/src/resultValidation.ts` or `packages/data/src/validation.ts`
- `apps/shell/src/gameOver.ts`

Failure behavior:

- In dev, log detailed validation errors.
- In production, do not record invalid results; show a shell error.

### 9.2 Match Schema Versioning

Add optional metadata:

```ts
interface MatchRecord {
  schemaVersion: 1;
  sdkVersion?: string;
  gameVersion?: string;
}
```

Keep old records readable.

### 9.3 Game-Specific Stat Views

Use manifest `statKeys` more deeply:

- show labels
- show units
- hide internal stats
- group match stats vs player stats
- allow per-game leaderboard sort by stat

Extend stat key metadata:

```ts
interface StatKeyDef {
  label: string;
  scope: "player" | "match";
  unit?: "count" | "ms" | "seconds" | "percent" | "points";
  higherIsBetter?: boolean;
  visible?: boolean;
}
```

---

## 10. Implementation Order

### Slice 1: Hardening

1. Fix Party Mix typecheck.
2. Wire pause/resume.
3. Make build run typecheck.
4. Update profile recency.
5. Refresh README status.

Why first: this makes the current system trustworthy before adding new APIs.

### Slice 2: Manifest Foundation

1. Extend manifest types with optional `input`, `settings`, and `presentation`.
2. Add `game.manifest.ts` for current games.
3. Keep shell UI behavior unchanged.
4. Add uniqueness/build tests.

Why second: controls and settings need a clean source of per-game capabilities.

### Slice 3: Forwarded Controls Prototype

1. Add SDK `inputFrame` message.
2. Add `@pfp/controls`.
3. Add shell forwarder.
4. Add a tiny sample/test game or migrate Pong in hybrid mode.

Why third: this is the main platform bet. Prove it with the smallest possible
game before touching larger games.

### Slice 4: Game Kit Prototype

1. Create `@pfp/game-kit`.
2. Implement fixed loop, canvas scaling, controls client, result builder.
3. Port Pong or create a new tiny demo game.
4. Add template.

Why fourth: the kit should be built on real controls, not on guessed APIs.

### Slice 5: Shell Host Refactor

1. Extract `GameHostController`.
2. Move control forwarder lifecycle into it.
3. Add structured errors.
4. Add disconnect overlay.

Why fifth: once lifecycle complexity grows, the React screen needs to shrink.

### Slice 6: AI Game Workflow

1. Add game spec template.
2. Add create-game script.
3. Add generated-game quality gates.
4. Generate one new small game using the kit.

Why sixth: by this point the platform path should be stable enough that
generated games are not duplicating infrastructure.

---

## 11. Risk Register

### Risk: Forwarded Input Adds Latency

Mitigation:

- Send frames once per shell ticker/frame.
- Use latest-frame semantics, not queued semantics.
- Keep direct input mode for games that need raw device polling.

### Risk: SDK Becomes Too Broad

Mitigation:

- Keep only the transport message type and raw frame type in `@pfp/sdk`.
- Put mapping, schemas, and helpers in `@pfp/controls`.
- Put loops/rendering/game helpers in `@pfp/game-kit`.

### Risk: Game Kit Becomes A Half-Baked Engine

Mitigation:

- Scope it to small 2D canvas games.
- Avoid complex physics, editors, or 3D.
- Keep escape hatches: raw canvas context, direct SDK mode, custom engines.

### Risk: Manifest Generation Adds Tooling Complexity

Mitigation:

- Start with explicit TypeScript manifest imports.
- Automate only after the shape stabilizes.
- Keep tests that verify the generated catalog.

### Risk: Existing Games Break During Migration

Mitigation:

- All new features are opt-in.
- Keep default `input.mode` as `direct`.
- Migrate one small game first.
- Use tests and manual shell launch checks after each slice.

---

## 12. Done Definition

The architecture work is complete when:

- Current direct-input games still work.
- At least one game runs fully on shell-forwarded controls.
- At least one game is built with `@pfp/game-kit`.
- A new game can be scaffolded from a template.
- The shell can launch games from manifest metadata.
- Pause/resume/terminate/result recording are reliable and tested.
- `pnpm test`, `pnpm typecheck`, and `pnpm build` are all green.
- Documentation clearly explains all three paths:
  - SDK-only custom game
  - forwarded-controls game
  - game-kit game
