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

---

## 13. Remaining Work Implementation Runbook

Status verified against the repo on 2026-06-24. Phase 0, the manifest type
foundation, `@pfp/controls`, shell-side forwarding, and Pong/Space Invaders
hybrid proof are already present. This section is the executable plan for the
remaining architecture work.

Use this section as the source of truth for implementation order. Each slice
should be small enough to review independently and should leave `pnpm test`,
`pnpm typecheck`, and the relevant package builds green before moving on.

### 13.1 Ground Rules For The Remaining Work

1. Preserve compatibility first.
   Existing games must keep launching from the shell after every slice. Do not
   convert a game to a new input mode in the same commit that introduces
   infrastructure unless the slice explicitly calls for it.

2. Keep APIs additive.
   `@pfp/sdk` should remain the small shared protocol package. Mapping helpers
   belong in `@pfp/controls`; game loop, canvas, assets, collision, and result
   helpers belong in `@pfp/game-kit`.

3. Prefer tests around pure helpers.
   React screens should delegate complicated decisions to helper modules that
   can be tested in Vitest without rendering a full app.

4. Keep generated files obvious.
   Generated files must start with a comment that says how to regenerate them.
   Do not hand-edit generated catalog output after the generator exists.

5. Commit by slice.
   Each slice below is a reasonable commit or PR boundary. If a slice gets too
   large, split it at the testable substep boundaries listed in that slice.

### 13.2 Slice A: Finish Manifest Catalog Generation

Goal: adding a game manifest should be enough for the shell catalog to discover
it. `apps/shell/src/games.ts` should map manifest metadata into shell view
models, but it should not manually import every game forever.

Current state:

- `games/*/game.manifest.ts` exists for current games.
- `apps/shell/src/games.ts` manually imports each manifest.
- `apps/shell/test/shellRules.test.ts` already checks unique IDs and built
  playable games.
- There is no `apps/shell/src/games.generated.ts`.
- There is no catalog generation script.

Files to add:

```text
scripts/generate-game-catalog.mjs
apps/shell/src/games.generated.ts
```

Files to edit:

```text
package.json
apps/shell/src/games.ts
apps/shell/test/shellRules.test.ts
docs/ADDING_A_GAME.md
```

Implementation steps:

1. Create `scripts/generate-game-catalog.mjs`.
   The script should:

   - Resolve the repo root from `import.meta.url`.
   - Read direct children of `games/`.
   - Keep only directories with `game.manifest.ts`.
   - Sort by directory name for stable output.
   - Generate one static TypeScript import per manifest.
   - Write `apps/shell/src/games.generated.ts`.

   The generated output should look like:

   ```ts
   // Generated by scripts/generate-game-catalog.mjs. Do not edit by hand.

   import ironYard from "../../../games/iron-yard/game.manifest.js";
   import partyMix from "../../../games/party-mix/game.manifest.js";
   import pong from "../../../games/pong/game.manifest.js";
   import raskulls from "../../../games/raskulls/game.manifest.js";
   import spaceInvaders from "../../../games/space-invaders/game.manifest.js";
   import stickSmash from "../../../games/stick-smash/game.manifest.js";

   import type { GameManifest } from "@pfp/sdk";

   export const GAME_MANIFESTS = [
     ironYard,
     partyMix,
     pong,
     raskulls,
     spaceInvaders,
     stickSmash,
   ] satisfies GameManifest[];
   ```

   Use safe import identifiers derived from the directory name:

   - Split on non-alphanumeric characters.
   - Lowercase the first segment.
   - Capitalize later segments.
   - Prefix with `game` if the result would start with a digit.

2. Add root package scripts:

   ```json
   {
     "scripts": {
       "generate:game-catalog": "node scripts/generate-game-catalog.mjs",
       "check:game-catalog": "node scripts/generate-game-catalog.mjs --check"
     }
   }
   ```

   `--check` should generate the expected string in memory, read the existing
   file, and exit non-zero with a short message if the file differs.

3. Generate the initial file:

   ```bash
   pnpm generate:game-catalog
   ```

4. Update `apps/shell/src/games.ts`.
   Replace manual imports with:

   ```ts
   import { GAME_MANIFESTS } from "./games.generated.js";
   ```

   Then define:

   ```ts
   export const GAMES: GameEntry[] = GAME_MANIFESTS.map(toGameEntry);
   ```

   Keep `toGameEntry`, `devEntryFor`, `CATEGORY_LABELS`, and local shell
   defaults in this file.

5. Extend catalog tests.
   Add or update tests in `apps/shell/test/shellRules.test.ts`:

   - `GAMES` IDs are unique.
   - Every enabled game has `thumbnail`.
   - Every enabled game has `entry` ending in `/index.html` in production
     manifest metadata.
   - Every enabled game has `build.built === true`.
   - `GAME_MANIFESTS.length === GAMES.length`.

6. Update `docs/ADDING_A_GAME.md`.
   State that game registration is now:

   - Add `games/my-game/game.manifest.ts`.
   - Run `pnpm generate:game-catalog`.
   - Add/copy production assets and build metadata.
   - Run catalog checks.

Verification commands:

```bash
pnpm generate:game-catalog
pnpm check:game-catalog
pnpm --filter @pfp/shell typecheck
pnpm vitest run apps/shell/test
```

Acceptance criteria:

- `apps/shell/src/games.ts` has no direct imports from `games/*`.
- Generated catalog output is deterministic.
- A missing catalog regeneration is caught by `pnpm check:game-catalog`.
- Shell tests still pass.

Suggested commit message:

```text
Generate shell game catalog from manifests
```

### 13.3 Slice B: Add Shell Settings Handshake

Goal: games can declare settings in their manifests, the shell can choose and
validate values, and launch context receives the selected settings.

Current state:

- `GameSettingsManifest` and `LaunchContext.settings` exist in `@pfp/sdk`.
- `GameScreen` always launches with `settings: {}`.
- `PairingScreen` has no settings panel.
- Shell store has no selected settings state.

Files to add:

```text
apps/shell/src/gameSettings.ts
apps/shell/test/gameSettings.test.ts
```

Files to edit:

```text
apps/shell/src/store.ts
apps/shell/src/screens/PairingScreen.tsx
apps/shell/src/screens/GameScreen.tsx
games/raskulls/game.manifest.ts
games/iron-yard/game.manifest.ts
apps/shell/src/style.css
```

Implementation steps:

1. Add `apps/shell/src/gameSettings.ts`.
   Export these helpers:

   ```ts
   import type { GameManifest, GameSettingDef } from "@pfp/sdk";

   export type GameSettingsValue = boolean | number | string;
   export type GameSettingsState = Record<string, GameSettingsValue>;

   export function defaultSettingsFor(game: Pick<GameManifest, "settings">): GameSettingsState;

   export function validateSettingsFor(
     game: Pick<GameManifest, "settings">,
     input: Record<string, unknown>,
   ): { ok: true; value: GameSettingsState } | { ok: false; errors: string[] };

   export function setGameSetting(
     game: Pick<GameManifest, "settings">,
     current: GameSettingsState,
     id: string,
     next: unknown,
   ): GameSettingsState;
   ```

   Validation rules:

   - Unknown setting IDs are ignored or reported as errors. Prefer errors for
     launch validation and ignoring only in UI helper paths.
   - Missing IDs use defaults.
   - Boolean fields accept booleans only.
   - Number fields accept finite numbers within `min` and `max`; if `step`
     exists, the UI should step by that value, but validation should not reject
     minor floating point drift.
   - Choice fields accept only option values declared in the manifest.

2. Extend shell store.
   In `apps/shell/src/store.ts`, add:

   ```ts
   selectedGameSettings: Record<string, unknown>;
   setSelectedGameSettings(settings: Record<string, unknown>): void;
   updateSelectedGameSetting(id: string, value: unknown): void;
   ```

   In `selectGame(game)`, initialize `selectedGameSettings` with
   `defaultSettingsFor(game)`.

3. Add a compact settings panel to `PairingScreen`.
   The panel should render only when `selectedGame.settings?.fields.length` is
   non-zero. Keep it inside the pairing screen rather than adding a new route
   for the first implementation.

   UI controls:

   - Boolean: checkbox or toggle button.
   - Number: `input type="number"` with `min`, `max`, `step`.
   - Choice: `select`.

   Controller support can be basic at first. The existing focus system handles
   button focus; keyboard/mouse should work. If controller interaction is weak,
   document that as follow-up rather than blocking the handshake.

4. Pass settings at launch.
   In `GameScreen`, read `selectedGameSettings` from `useShell()`. Before
   `host.launch(context)`, call `validateSettingsFor(game, selectedGameSettings)`.

   - If valid, set `context.settings = validated.value`.
   - If invalid, set `phase` to `error`, log the errors, and do not launch.

5. Add first settings to manifests.
   Use settings that can be wired without large game refactors.

   Raskulls:

   ```ts
   settings: {
     fields: [
       {
         id: "raceBots",
         label: "Fill race with bots",
         type: "boolean",
         default: true,
       },
     ],
   }
   ```

   Then update `games/raskulls/src/scenes/PlayScene.ts` so `withRaceBots`
   only fills bots when `session.context?.settings.raceBots !== false`.

   Iron Yard:

   ```ts
   settings: {
     fields: [
       {
         id: "scoreToWin",
         label: "Score to win",
         type: "number",
         min: 1,
         max: 10,
         step: 1,
         default: 3,
       },
     ],
   }
   ```

   Only wire this into the game if the current Iron Yard code already has a
   simple score target. If not, leave it as manifest-only and use Raskulls as
   the first actual consumer.

6. Tests:

   - `defaultSettingsFor` returns defaults for all field types.
   - `validateSettingsFor` rejects out-of-range number values.
   - `validateSettingsFor` rejects invalid choice values.
   - Store `selectGame` resets settings to defaults.
   - `GameScreen` launch helper, if extracted, passes validated settings.

Verification commands:

```bash
pnpm vitest run apps/shell/test/gameSettings.test.ts
pnpm vitest run apps/shell/test
pnpm --filter @pfp/shell typecheck
pnpm --filter @pfp/raskulls typecheck
```

Acceptance criteria:

- `LaunchContext.settings` is no longer always `{}`.
- At least one game reads one shell-selected setting.
- Invalid settings cannot be launched.
- Games without settings behave exactly as before.

Suggested commit message:

```text
Add shell launch settings handshake
```

### 13.4 Slice C: Promote Proved Games From Hybrid To Forwarded

Goal: prove that shell-forwarded controls can be the sole shell input path for
simple games while keeping standalone dev fallback available.

Current state:

- Pong and Space Invaders have `input.mode: "hybrid"`.
- Both have `ForwardedInputReader`.
- The shell creates a forwarder for `forwarded` and `hybrid`.
- Standalone fallback still polls direct input when no forwarded frame exists.

Files to inspect/edit:

```text
games/pong/game.manifest.ts
games/pong/src/forwardedInput.ts
games/pong/src/input.ts
games/pong/src/main.ts
games/pong/test/forwardedInput.test.ts
games/space-invaders/game.manifest.ts
games/space-invaders/src/forwardedInput.ts
games/space-invaders/src/input.ts
games/space-invaders/src/main.ts
games/space-invaders/test/forwardedInput.test.ts
apps/shell/test/gameScreenLifecycle.test.ts
apps/shell/test/shellRules.test.ts
```

Implementation steps:

1. Add an explicit helper in each game:

   ```ts
   function sampleInput(context: {
     forwarded: ForwardedInputReader;
     direct: InputReader;
     launchedByShell: boolean;
   }): InputFrame {
     const frame = context.forwarded.sample();
     if (frame) return frame;
     return context.direct.sample();
   }
   ```

   Keep the direct fallback so local standalone launch is still playable. The
   mode name controls shell behavior, not necessarily whether standalone dev
   code exists.

2. Change manifest `input.mode` from `"hybrid"` to `"forwarded"` for Pong.

3. Run Pong-specific tests and manually smoke launch through shell if a dev
   server is already in use for this work.

4. Repeat for Space Invaders only after Pong is green.

5. Update the "Current Status" section of this plan after both are promoted.

Testing requirements:

- Existing forwarded input tests still pass.
- Add a test that a missing forwarded frame still falls back to direct sample
  for standalone development.
- Confirm `usesShellForwardedInput({ input: { mode: "forwarded" } })` remains
  true.

Verification commands:

```bash
pnpm vitest run games/pong/test games/space-invaders/test apps/shell/test
pnpm --filter @pfp/pong typecheck
pnpm --filter @pfp/space-invaders typecheck
pnpm --filter @pfp/shell typecheck
```

Acceptance criteria:

- Pong and Space Invaders manifests use `forwarded`.
- Both games remain playable standalone.
- Shell still sends frames only for `forwarded` or `hybrid` games.

Suggested commit message:

```text
Promote simple games to forwarded controls
```

### 13.5 Slice D: Build `@pfp/game-kit`

Goal: provide a small runtime for generated and first-party 2D canvas games,
without becoming a general engine.

Files to add:

```text
packages/game-kit/package.json
packages/game-kit/tsconfig.json
packages/game-kit/src/index.ts
packages/game-kit/src/runtime.ts
packages/game-kit/src/loop.ts
packages/game-kit/src/canvas.ts
packages/game-kit/src/assets.ts
packages/game-kit/src/audio.ts
packages/game-kit/src/collision.ts
packages/game-kit/src/math.ts
packages/game-kit/src/results.ts
packages/game-kit/src/testing.ts
packages/game-kit/test/loop.test.ts
packages/game-kit/test/collision.test.ts
packages/game-kit/test/results.test.ts
packages/game-kit/test/testing.test.ts
```

Package setup:

```json
{
  "name": "@pfp/game-kit",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pfp/controls": "workspace:*",
    "@pfp/sdk": "workspace:*"
  },
  "devDependencies": {}
}
```

Implementation order:

1. `math.ts`
   Add pure helpers first:

   ```ts
   export function clamp(value: number, min: number, max: number): number;
   export function lerp(a: number, b: number, t: number): number;
   export function seededRandom(seed: number): () => number;
   ```

2. `collision.ts`
   Add:

   ```ts
   export interface Rect {
     x: number;
     y: number;
     w: number;
     h: number;
   }

   export interface Circle {
     x: number;
     y: number;
     r: number;
   }

   export function rectsOverlap(a: Rect, b: Rect): boolean;
   export function circleRectOverlap(circle: Circle, rect: Rect): boolean;
   export function containRect(rect: Rect, bounds: Rect): Rect;
   ```

   Tests should cover touching edges, overlap, containment, and circle near
   rectangle corners.

3. `loop.ts`
   Implement `FixedStepLoop`.

   Suggested constructor:

   ```ts
   export interface FixedStepLoopOptions {
     stepMs?: number;
     maxAccumulatedMs?: number;
     now?: () => number;
     requestFrame?: (callback: FrameRequestCallback) => number;
     cancelFrame?: (id: number) => void;
     update: (dtMs: number) => void;
     render?: (alpha: number) => void;
   }
   ```

   Behavior:

   - Default `stepMs` is `1000 / 60`.
   - Default `maxAccumulatedMs` is `250`.
   - `start()` begins RAF loop once.
   - `stop()` cancels RAF and clears accumulated time.
   - `pause()` stops update progression but keeps state.
   - `resume()` resets `lastNow` so no huge catch-up step occurs.
   - Each RAF tick accumulates elapsed time, caps it, calls `update(stepMs)`
     while accumulated time is at least one step, then calls `render(alpha)`.

   Tests should use fake `now`, `requestFrame`, and `cancelFrame` functions so
   loop behavior is deterministic.

4. `canvas.ts`
   Add:

   ```ts
   export interface Size {
     width: number;
     height: number;
   }

   export interface CanvasViewport {
     width: number;
     height: number;
     scale: number;
     offsetX: number;
     offsetY: number;
   }

   export function computeViewport(container: Size, logical: Size): CanvasViewport;
   export function fitCanvasToWindow(canvas: HTMLCanvasElement, logical: Size): CanvasViewport;
   ```

   Keep `computeViewport` pure and test it. `fitCanvasToWindow` can remain thin.

5. `results.ts`
   Add result builder:

   ```ts
   import type { GameResult, LaunchContext, PlayerStanding } from "@pfp/sdk";

   export interface ScoreInput {
     slot: number;
     score: number;
     stats?: Record<string, number>;
   }

   export function standingsFromScores(
     launch: LaunchContext,
     scores: ScoreInput[],
   ): PlayerStanding[];

   export function createGameResult(input: {
     gameId: string;
     launch: LaunchContext;
     startedAt: number;
     endedAt?: number;
     scores: ScoreInput[];
     gameStats?: Record<string, unknown>;
   }): GameResult;
   ```

   Ranking rules:

   - Higher score wins by default.
   - Ties share rank.
   - Next rank skips tied positions, e.g. `1, 1, 3`.
   - Profile IDs come from launch players.
   - Unknown slots throw in dev helpers instead of silently creating standings.

6. `assets.ts`
   Start with image loading only if audio buffers complicate the first pass:

   ```ts
   export interface AssetManifest {
     images?: Record<string, string>;
     audio?: Record<string, string>;
   }

   export class AssetStore {
     load(manifest: AssetManifest): Promise<void>;
     image(key: string): HTMLImageElement | null;
   }
   ```

   Missing assets should not crash the kit; the game can draw primitives when
   `image(key)` returns `null`.

7. `audio.ts`
   Add a tiny WebAudio wrapper:

   ```ts
   export class KitAudio {
     unlock(): Promise<void>;
     beep(options?: { frequency?: number; durationMs?: number; volume?: number }): void;
     noise(options?: { durationMs?: number; volume?: number }): void;
     setMuted(muted: boolean): void;
   }
   ```

   Keep tests limited to construction and muted behavior unless the test
   environment has WebAudio support.

8. `runtime.ts`
   Wire SDK and controls:

   ```ts
   import type { ControlFrame, ControlSchema } from "@pfp/controls";
   import type { GameResult, LaunchContext } from "@pfp/sdk";

   export interface KitGameContext {
     launch: LaunchContext;
     canvas: HTMLCanvasElement;
     audio: KitAudio;
     assets: AssetStore;
   }

   export interface KitGame<TState = unknown> {
     state?: TState;
     update(dtMs: number, input: ControlFrame): void;
     render(ctx: CanvasRenderingContext2D, viewport: CanvasViewport): void;
     onPause?(): void;
     onResume?(): void;
     onTerminate?(): void;
     isFinished?(): boolean;
     getResult?(): GameResult;
   }

   export interface GameDefinition<TState = unknown> {
     id: string;
     logicalSize: Size;
     input?: ControlSchema;
     create(context: KitGameContext): KitGame<TState>;
   }

   export function runGame(definition: GameDefinition): void;
   ```

   `runGame()` responsibilities:

   - Create `GameClient`.
   - Create `ControlClient`.
   - Wait for launch.
   - Find or create a canvas element.
   - Fit the canvas to window.
   - Create assets/audio.
   - Start `FixedStepLoop`.
   - On pause, pause loop and call game hook.
   - On resume, resume loop and call game hook.
   - On terminate, stop loop, remove listeners, and call game hook.
   - On finished game, call `client.gameOver(result)` exactly once.

9. `testing.ts`
   Add helpers:

   ```ts
   export function makeLaunchContext(playerCount: number): LaunchContext;
   export function makeControlFrame(patch?: Partial<ControlFrame>): ControlFrame;
   export function stepGame(
     game: Pick<KitGame, "update">,
     frames: ControlFrame[],
     stepMs?: number,
   ): void;
   ```

10. `index.ts`
    Re-export stable public APIs. Do not export every internal helper by
    accident.

Verification commands:

```bash
pnpm --filter @pfp/game-kit typecheck
pnpm vitest run packages/game-kit/test
pnpm typecheck
```

Acceptance criteria:

- `@pfp/game-kit` has no React or shell dependency.
- Pure helpers are covered by tests.
- `runGame` can be used by a template game without extra SDK boilerplate.

Suggested commit message:

```text
Add game-kit runtime package
```

### 13.6 Slice E: Add Starter Templates

Goal: make the desired architecture easy to copy by humans and AI agents.

Files to add:

```text
games/_template-game-kit/game.manifest.ts
games/_template-game-kit/index.html
games/_template-game-kit/package.json
games/_template-game-kit/tsconfig.json
games/_template-game-kit/vite.config.ts
games/_template-game-kit/src/main.ts
games/_template-game-kit/src/game.ts
games/_template-game-kit/src/style.css
games/_template-game-kit/test/game.test.ts
games/_template-sdk/game.manifest.ts
games/_template-sdk/index.html
games/_template-sdk/package.json
games/_template-sdk/tsconfig.json
games/_template-sdk/vite.config.ts
games/_template-sdk/src/main.ts
games/_template-sdk/src/input.ts
games/_template-sdk/src/style.css
docs/ADDING_A_GAME.md
```

Template token convention:

Use clear placeholders that `scripts/create-game.mjs` can replace later:

```text
__GAME_ID__
__GAME_NAME__
__PACKAGE_NAME__
__DEV_PORT__
```

Game-kit template requirements:

- Manifest `input.mode` is `forwarded`.
- Manifest includes action bindings for:
  - `moveX`
  - `moveY`
  - `primary`
  - `start`
  - `back`
- `src/main.ts` only imports `runGame` and the local definition.
- `src/game.ts` exports a game definition with:
  - countdown state
  - playing state
  - finished state
  - deterministic update logic
  - result creation through `@pfp/game-kit`
- Test covers scoring or win condition without DOM.

SDK template requirements:

- Manifest `input.mode` is `direct`.
- `src/main.ts` demonstrates:
  - `createGameClient()`
  - `onLaunch`
  - `onPause`
  - `onResume`
  - `onTerminate`
  - `gameOver`
  - direct keyboard/gamepad polling cleanup
- Keep it intentionally plain, suitable for Phaser, Three.js, or custom engines.

Important template rule:

Do not include `_template-*` directories in the generated shell catalog. The
catalog generator should skip game directories whose names start with `_`.

Tests:

- Add a generator/catalog test or shell rule proving `_template-game-kit` and
  `_template-sdk` are excluded.
- Add template package typecheck only if templates are copied into real package
  names during test. Do not break workspace scripts by adding templates as
  normal workspace packages unless their placeholder package names are valid.

Verification commands:

```bash
pnpm generate:game-catalog
pnpm check:game-catalog
pnpm vitest run apps/shell/test
pnpm typecheck
```

Acceptance criteria:

- Templates are documented and excluded from runtime catalog.
- A developer can copy either template manually and know what to replace.
- Game-kit template demonstrates the recommended path.

Suggested commit message:

```text
Add game starter templates
```

### 13.7 Slice F: Add `scripts/create-game.mjs`

Goal: scaffold a new blank game from templates in under a minute.

Files to add/edit:

```text
scripts/create-game.mjs
package.json
docs/GAME_SPEC_TEMPLATE.md
docs/ADDING_A_GAME.md
```

Command shape:

```bash
pnpm create-game my-game --template game-kit
pnpm create-game my-custom-game --template sdk --port 5188
```

Root package script:

```json
{
  "scripts": {
    "create-game": "node scripts/create-game.mjs"
  }
}
```

Implementation details:

1. Parse arguments without adding a dependency.
   Supported args:

   - positional `game-id`
   - `--template game-kit | sdk`
   - optional `--name "Display Name"`
   - optional `--port 5188`
   - optional `--no-catalog`

2. Validate `game-id`.

   - kebab-case only: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
   - reject IDs that already exist under `games/`
   - reject IDs beginning with `_`

3. Pick display name.
   If `--name` is absent, convert `my-game` to `My Game`.

4. Pick package name.

   ```text
   @pfp/my-game
   ```

5. Pick dev port.
   If `--port` is absent:

   - Read existing `games/*/game.manifest.ts`.
   - Extract `build.devPort` values with a conservative regex.
   - Start at `5180`.
   - Pick the first unused port.

6. Copy template recursively.
   Skip generated build output, if any.

7. Replace tokens in text files.
   Treat these extensions as text:

   ```text
   .ts .tsx .js .mjs .json .html .css .md
   ```

8. Optionally run catalog generation.
   Default should run:

   ```bash
   node scripts/generate-game-catalog.mjs
   ```

   `--no-catalog` should skip this for quick experiments.

9. Print next commands:

   ```bash
   pnpm install
   pnpm --filter @pfp/my-game typecheck
   pnpm --filter @pfp/my-game dev
   ```

`docs/GAME_SPEC_TEMPLATE.md` should include:

- Game name and concept.
- Player count.
- Integration mode.
- Controls.
- Core loop.
- Win condition.
- Scoring.
- Entities.
- Collision rules.
- Audio/visual style.
- Required stats.
- Tests.
- Explicit out-of-scope items.

Tests:

- If there is no existing script-test harness, keep script logic small and
  extract pure helpers to `scripts/create-game-lib.mjs` only if testing becomes
  painful.
- At minimum, manually verify by creating a temporary game under `/tmp` or a
  throwaway repo copy. Do not leave generated scratch games committed.

Verification commands:

```bash
pnpm create-game sample-kit --template game-kit --no-catalog
pnpm create-game sample-sdk --template sdk --no-catalog
```

Then remove the generated sample directories before committing.

Acceptance criteria:

- A new game directory is scaffolded with correct IDs, names, package name, and
  dev port.
- Catalog generation can include the new game.
- Documentation tells agents to start from a spec before generating code.

Suggested commit message:

```text
Add game creation workflow
```

### 13.8 Slice G: Extract `GameHostController`

Goal: move iframe host lifecycle, SDK launch, settings validation, control
forwarding, result handling, and errors out of `GameScreen.tsx`.

Current state:

- `GameScreen.tsx` owns iframe refs, SDK host, forwarder, timeout, launch,
  game over, request exit, SDK errors, and overlay UI.
- `gameScreenLifecycle.ts` already owns some transition logic.

Files to add:

```text
apps/shell/src/host/types.ts
apps/shell/src/host/GameHostController.ts
apps/shell/src/host/useGameHost.ts
apps/shell/test/GameHostController.test.ts
```

Files to edit:

```text
apps/shell/src/screens/GameScreen.tsx
apps/shell/src/screens/gameScreenLifecycle.ts
apps/shell/test/gameScreenLifecycle.test.ts
```

Types:

```ts
export type GameHostPhase = "idle" | "loading" | "playing" | "paused" | "done" | "error";

export type GameLaunchError =
  | { kind: "missing-game" }
  | { kind: "load-timeout"; gameId: string }
  | { kind: "invalid-settings"; gameId: string; errors: string[] }
  | { kind: "sdk-incompatible"; gameId: string; gameSdkRange: string; hostVersion: string }
  | { kind: "game-error"; gameId: string; message: string }
  | { kind: "persistence-error"; gameId: string; error: unknown };

export interface GameHostControllerEvents {
  onPhaseChange(phase: GameHostPhase): void;
  onError(error: GameLaunchError): void;
  onGameOver(result: GameResult): void;
  onRequestExit(): void;
}
```

Controller dependencies:

```ts
export interface GameHostControllerOptions {
  iframe: HTMLIFrameElement;
  game: GameEntry;
  pairedSlots: PairingSlot[];
  profiles: Profile[];
  settings: Record<string, unknown>;
  ticker: ShellTicker;
  recordMatch: (result: GameResult) => Promise<void>;
  events: GameHostControllerEvents;
  loadTimeoutMs?: number;
}
```

Controller methods:

```ts
export class GameHostController {
  start(): void;
  pause(): void;
  resume(): void;
  terminate(): void;
  dispose(): void;
}
```

Implementation steps:

1. Extract player launch-context creation into a pure helper:

   ```ts
   export function buildLaunchPlayers(
     pairedSlots: PairingSlot[],
     profiles: Profile[],
   ): PlayerSlot[];
   ```

   Test guest fallback names and colors.

2. Extract control forwarder creation into a controller private method.
   Keep the existing `KeyboardControlSource` behavior.

3. Move load timeout into controller.
   On timeout:

   - emit `{ kind: "load-timeout", gameId }`
   - set phase `error`
   - terminate/dispose host

4. Move SDK event handlers into controller:

   - `onReady`: validate settings, launch, create forwarder, phase `playing`
   - `onGameOver`: phase `done`, dispose forwarder, emit result
   - `onRequestExit`: dispose and emit request exit
   - `onError`: emit structured game error
   - `onIncompatible`: emit structured compatibility error

5. Update `GameScreen.tsx`.
   It should own:

   - iframe element
   - visible overlay state
   - mapping controller events to shell store/navigation
   - pause/resume button input

   It should not know how to build SDK context or create control forwarders.

6. Add `useGameHost.ts`.
   Keep it thin:

   - create controller in an effect
   - dispose on unmount or selected game change
   - return `{ phase, error, pause, resume, terminate }`

7. Tests:

   Prefer unit tests around `GameHostController` using a fake iframe and fake
   SDK host factory. If `createIframeHost` is hard to mock, first add a
   dependency injection parameter:

   ```ts
   hostFactory?: typeof createIframeHost;
   ```

   Test:

   - ready launches with players and settings
   - invalid settings produces structured error
   - pause calls host pause and pauses forwarder
   - resume calls host resume and resumes forwarder
   - game over disposes forwarder and emits result
   - dispose terminates live game

Verification commands:

```bash
pnpm vitest run apps/shell/test/GameHostController.test.ts apps/shell/test/gameScreenLifecycle.test.ts
pnpm --filter @pfp/shell typecheck
```

Acceptance criteria:

- `GameScreen.tsx` is mostly presentation and user input.
- Host lifecycle can be tested without rendering the whole screen.
- Existing pause/resume tests still pass.

Suggested commit message:

```text
Extract shell game host controller
```

### 13.9 Slice H: Add Controller Disconnect Handling

Goal: if a required in-game controller disconnects, the shell pauses the game
and shows a reconnect overlay.

Files to edit/add:

```text
apps/shell/src/host/GameHostController.ts
apps/shell/src/screens/GameScreen.tsx
apps/shell/src/screens/gameScreenLifecycle.ts
apps/shell/test/gameScreenLifecycle.test.ts
apps/shell/test/GameHostController.test.ts
packages/controls/src/shell.ts
packages/controls/test/controls.test.ts
```

Implementation details:

1. Track required gamepad indices at launch.
   Required means:

   - Paired physical controllers with `gamepadIndex >= 0`.
   - Keyboard slots do not need disconnect handling.

2. In controller, subscribe to ticker.
   Each tick:

   - Compare required indices with `ticker.poller.connectedIndices()`.
   - If a required index disappears while phase is `playing`, call `pause()`
     and emit a disconnect phase or event.
   - If all required indices return, allow resume.

3. Extend phase or overlay state.
   Keep host phase simple if possible and model overlay reason separately:

   ```ts
   type GameOverlayReason = "pause" | "controller-disconnected";
   ```

4. UI behavior:

   - Show player/controller label that disconnected.
   - Primary action: continue when reconnected.
   - Secondary action: quit.
   - Start/A should resume only when required controllers are connected.

5. Forwarded games:

   - While disconnected, forwarder should either be paused or send frames with
     `connected: false`.
   - Existing `KeyboardControlSource` should not silently take over a physical
     player's slot during a disconnect overlay unless the user explicitly
     re-pairs. For this slice, pause is safer.

6. Direct-input games:

   - Shell pause still prevents the game from continuing behind the overlay.

Tests:

- Connected required controllers produce no overlay.
- Disconnect during playing pauses host exactly once.
- Reconnect enables resume.
- Keyboard-only player does not trigger disconnect overlay.
- Quit from disconnect overlay terminates host.

Verification commands:

```bash
pnpm vitest run apps/shell/test packages/controls/test
pnpm --filter @pfp/shell typecheck
pnpm --filter @pfp/controls typecheck
```

Acceptance criteria:

- A controller disconnect cannot leave a live match running unseen.
- Direct and forwarded games both pause on disconnect.
- The user has a clear route to resume or quit.

Suggested commit message:

```text
Pause games on controller disconnect
```

### 13.10 Slice I: Add Result Validation And Match Versioning

Goal: invalid game results should not corrupt long-term shell data.

Files to add/edit:

```text
packages/sdk/src/resultValidation.ts
packages/sdk/src/index.ts
packages/sdk/test/resultValidation.test.ts
packages/data/src/types.ts
packages/data/src/memory.ts
packages/data/src/indexeddb.ts
packages/data/test/memory.test.ts
packages/data/test/indexeddb.test.ts
apps/shell/src/gameOver.ts
apps/shell/test/gameOver.test.ts
```

Validation API:

```ts
import type { GameResult, LaunchContext } from "./types.js";

export interface ResultValidationInput {
  selectedGameId: string;
  launch: LaunchContext;
  result: GameResult;
}

export type ResultValidationIssue =
  | { kind: "wrong-game-id"; expected: string; actual: string }
  | { kind: "wrong-session-id"; expected: string; actual: string }
  | { kind: "missing-standing"; slot: number }
  | { kind: "unknown-slot"; slot: number }
  | { kind: "duplicate-standing"; slot: number }
  | { kind: "invalid-rank"; slot: number; rank: unknown }
  | { kind: "invalid-score"; slot: number; score: unknown }
  | { kind: "invalid-stat"; slot: number; key: string; value: unknown };

export function validateGameResult(input: ResultValidationInput): ResultValidationIssue[];
```

Rules:

- `result.gameId` must equal selected game id.
- `result.sessionId` must equal launch session id.
- Every launched player slot must appear exactly once.
- No unknown slot may appear.
- Ranks must be positive integers.
- Scores, when present, must be finite numbers.
- Per-player stats, when present, must be finite numbers.
- `endedAt >= startedAt`.

Match versioning:

Update `MatchRecord`:

```ts
interface MatchRecord {
  schemaVersion: 1;
  sdkVersion?: string;
  gameVersion?: string;
}
```

Migration behavior:

- Old records without `schemaVersion` are treated as version 0 or normalized to
  version 1 when read.
- Do not break existing IndexedDB data.

Shell behavior:

- `GameHostController` should keep the launch context for validation.
- Before `recordMatchBestEffort`, validate the result.
- In dev, log all validation issues.
- In production, do not record invalid results and show structured shell error.

Tests:

- Wrong game ID rejected.
- Wrong session ID rejected.
- Missing standing rejected.
- Unknown slot rejected.
- Duplicate slot rejected.
- NaN score rejected.
- Old match records remain readable.

Verification commands:

```bash
pnpm vitest run packages/sdk/test/resultValidation.test.ts packages/data/test apps/shell/test/gameOver.test.ts
pnpm --filter @pfp/sdk typecheck
pnpm --filter @pfp/data typecheck
pnpm --filter @pfp/shell typecheck
```

Acceptance criteria:

- Invalid results do not get recorded silently.
- Existing records remain readable.
- Validation issues are actionable in development.

Suggested commit message:

```text
Validate game results before recording
```

### 13.11 Slice J: Improve Game-Specific Stat Views

Goal: use manifest `statKeys` metadata to make stats screens more useful as the
game library grows.

Files to inspect/edit:

```text
apps/shell/src/screens/StatsScreen.tsx
apps/shell/src/screens/ResultsScreen.tsx
apps/shell/src/store.ts
apps/shell/src/games.ts
packages/sdk/src/types.ts
apps/shell/test/
games/*/game.manifest.ts
```

Implementation steps:

1. Extend `StatKeyDef` only if needed.
   Current fields:

   ```ts
   interface StatKeyDef {
     label: string;
     scope: "player" | "match";
   }
   ```

   Optional additions:

   ```ts
   unit?: "count" | "time-ms" | "percent" | "score";
   higherIsBetter?: boolean;
   hidden?: boolean;
   ```

2. Add stat formatting helper:

   ```ts
   export function formatStatValue(value: number, def?: StatKeyDef): string;
   export function visibleStatKeys(game: GameManifest): Array<[string, StatKeyDef]>;
   ```

3. Update manifests with useful stat labels.
   Start with games that already report stats:

   - Raskulls: blocks broken, gems, eliminations, deaths, finish time.
   - Pong: rallies, goals, maybe longest rally if available.
   - Space Invaders: score, shots, hits, lives or waves if available.

4. Update Results screen.
   Where a result has `standing.stats`, show labels from `selectedGame.statKeys`
   instead of raw keys when metadata exists.

5. Update Stats screen.
   Add per-game filtering or grouping:

   - game selector
   - profile selector remains if already present
   - stat rows use manifest labels
   - hidden stats are omitted

6. Tests:

   - Formatting time milliseconds.
   - Hidden stats omitted.
   - Unknown stat keys fall back to raw key.
   - Results screen helper maps labels correctly.

Verification commands:

```bash
pnpm vitest run apps/shell/test
pnpm --filter @pfp/shell typecheck
```

Acceptance criteria:

- Stats UI is readable without knowing internal stat key names.
- Unknown game stats still display safely.
- Manifest metadata drives labels and visibility.

Suggested commit message:

```text
Use manifest metadata for game stats
```

### 13.12 Slice K: Update Documentation And Close The Shell TODO

Goal: after the implementation slices are complete, make documentation reflect
the real platform instead of future plans.

Files to edit:

```text
README.md
TODO.md
docs/ARCHITECTURE.md
docs/ADDING_A_GAME.md
docs/SHELL_ARCHITECTURE_IMPLEMENTATION_PLAN.md
```

Implementation steps:

1. Update `README.md`.
   Include:

   - current playable games
   - integration modes
   - commands for dev, test, typecheck, build
   - create-game command

2. Update `docs/ARCHITECTURE.md`.
   Include:

   - package responsibilities
   - SDK vs controls vs game-kit boundaries
   - host controller lifecycle
   - result validation path

3. Update `docs/ADDING_A_GAME.md`.
   Make it procedural:

   - choose SDK-only, forwarded controls, or game-kit
   - create from template
   - fill game spec
   - verify standalone launch
   - verify shell launch
   - verify result recording
   - add assets
   - regenerate catalog

4. Update this plan's `Current Status`.
   Move completed remaining slices into the completed list.

5. Mark `TODO.md` shell architecture item complete only when:

   - generated catalog exists
   - settings handshake exists
   - at least one game-kit game exists or a verified template exists, depending
     on how strict the team wants the done definition
   - host controller exists
   - create-game exists
   - result validation exists
   - tests/typecheck/build are green

Verification commands:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm check:game-catalog
```

Suggested commit message:

```text
Document completed shell architecture
```

### 13.13 Recommended Commit Order

Use this order unless an urgent bug forces a smaller patch first:

1. Generate shell game catalog from manifests.
2. Add shell launch settings handshake.
3. Promote simple games to forwarded controls.
4. Add game-kit runtime package.
5. Add game starter templates.
6. Add game creation workflow.
7. Extract shell game host controller.
8. Pause games on controller disconnect.
9. Validate game results before recording.
10. Use manifest metadata for game stats.
11. Document completed shell architecture.

### 13.14 Full Verification Matrix

Run targeted checks after each slice, then run the full matrix before marking
the TODO complete:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm check:game-catalog
pnpm --filter @pfp/sdk typecheck
pnpm --filter @pfp/controls typecheck
pnpm --filter @pfp/game-kit typecheck
pnpm --filter @pfp/shell typecheck
pnpm vitest run apps/shell/test packages/sdk/test packages/controls/test packages/game-kit/test
```

Manual smoke checks before closing the plan:

1. Launch the shell.
2. Start Pong with keyboard-only pairing.
3. Pause and resume from shell overlay.
4. Finish a Pong match and confirm result recording.
5. Start Space Invaders with at least two players if controllers are available.
6. Launch a Raskulls race with `raceBots` enabled and disabled.
7. Create a throwaway game from the game-kit template.
8. Confirm the throwaway game can run standalone and through the shell.
9. Delete the throwaway game or keep it only if it is intended to become a real
   committed game.

### 13.15 Hand-Off Prompt For Future Agents

When assigning the next implementation slice, use a precise prompt like:

```text
Implement Slice A from docs/SHELL_ARCHITECTURE_IMPLEMENTATION_PLAN.md section
13.2. Keep the change scoped to catalog generation, generated shell imports,
tests, and docs. Run the verification commands listed in that section.
```

This avoids accidentally starting the whole architecture effort in one large
change.
