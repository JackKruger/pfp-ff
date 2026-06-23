# Stick Smash Integration Checklist

> **Audience:** an implementer bringing
> <https://github.com/KreatureofKreation/stick-smash> into PFP-FF as a
> first-class shell game.
>
> Follow this in order. The intended architecture is a thin PFP adapter around
> Stick Smash's existing browser game, not a rewrite of the PFP shell controls.

---

## 0. Scope and Key Decisions

- [x] Confirm the source can legally be vendored.
  - The upstream Stick Smash repo did not have a `LICENSE` file when inspected.
  - Do not copy it into this repo unless the owner grants permission, adds a
    license, or confirms this repo is allowed to vendor it.
- [x] Use `games/stick-smash/` as the final location.
- [x] Keep Stick Smash's standalone mode working where practical.
- [x] Add a separate PFP shell-launch mode beside the existing upstream menu,
  local multiplayer, and online flows.
- [x] Use shell-forwarded controls through `@pfp/controls`.
  - This avoids rewriting controls for existing games.
  - Start with `input.mode: "hybrid"` so direct gamepad fallback can still work
    during standalone development.

---

## 1. Current System Facts

- [x] Read [docs/ADDING_A_GAME.md](ADDING_A_GAME.md).
- [x] Read [docs/CONTROLS.md](CONTROLS.md).
- [x] Use `games/pong` as the reference for shell-forwarded controls.
- [x] Use `games/iron-yard` as the reference for a physics fighting game with
  SDK lifecycle and shell results.

Important existing shell behavior:

- The shell loads games in an iframe.
- Games call `client.ready()`.
- The shell sends `LaunchContext` through `client.onLaunch(...)`.
- Games call `client.gameOver(...)`.
- The shell records the result and navigates to Results.
- Shell-forwarded controls are available for games whose manifest declares
  `input.mode` as `"forwarded"` or `"hybrid"`.

---

## 2. Upstream Stick Smash Facts

- [x] Source repo: <https://github.com/KreatureofKreation/stick-smash>.
- [x] Upstream commit inspected: `bbf861119093fe5a03f806c4c2bdbc7340771bc7`
  on `master`.
- [x] Upstream app type: no-build browser ES modules.
- [x] Upstream dependencies:
  - Three.js via import map.
  - Rapier WASM via `@dimforge/rapier3d-compat`.
  - `cannon-es` imports are shimmed by `src/physics/cannon-shim.js`.
  - PeerJS for online multiplayer.
- [x] Upstream entry files:
  - `index.html`
  - `src/main.js`
  - `src/Game.js`
  - `src/input/Input.js`
- [x] Upstream game-over logic lives in `Game._checkGameOver()`.
- [x] Upstream input snapshot shape is:

```js
{
  moveX,
  moveY,
  jump,
  attack,
  grab,
  special,
  throw,
  aimX,
  aimY,
  aimActive
}
```

---

## 3. Create the Game Package

- [x] Create this folder structure:

```text
games/stick-smash/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  game.manifest.ts
  src/
    ...
  test/
    pfpControls.test.ts
    resultAdapter.test.ts
```

- [x] Vendor upstream Stick Smash files into `games/stick-smash/` after the
  license/permission step is satisfied.
- [x] Convert the upstream import-map setup to Vite package dependencies.
- [x] Add `package.json`:

```json
{
  "name": "@pfp/stick-smash",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5178",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0 --port 4178",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@dimforge/rapier3d-compat": "^0.14.0",
    "@pfp/controls": "workspace:*",
    "@pfp/sdk": "workspace:*",
    "peerjs": "^1.5.4",
    "three": "^0.160.0"
  }
}
```

- [x] Add `vite.config.ts` with `cannon-es` aliased to the local shim:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/games/stick-smash/",
  build: { target: "esnext" },
  server: { port: 5178, strictPort: true },
  resolve: {
    alias: {
      "cannon-es": fileURLToPath(new URL("./src/physics/cannon-shim.js", import.meta.url)),
    },
  },
  optimizeDeps: { exclude: ["@dimforge/rapier3d-compat"] },
});
```

- [x] Copy a compatible `tsconfig.json` from another game package.
- [x] Update `index.html` to remove the import map and load the Vite entry.

---

## 4. Add the Manifest

- [x] Create `games/stick-smash/game.manifest.ts`.
- [x] Use id `stick-smash`.
- [x] Use name `Stick Smash`.
- [x] Use players `{ min: 2, max: 4 }` unless solo shell launch is explicitly
  desired.
- [x] Use `input.mode: "hybrid"` for the first integration.
- [x] Add action mappings:

```ts
input: {
  mode: "hybrid",
  actions: {
    moveX: [{ source: "leftStickX", deadzone: 0.18 }, { source: "dpadX" }],
    moveY: [
      { source: "leftStickY", deadzone: 0.18, scale: -1 },
      { source: "dpadY", scale: -1 },
    ],
    aimX: [{ source: "rightStickX", deadzone: 0.25 }],
    aimY: [{ source: "rightStickY", deadzone: 0.25, scale: -1 }],
    jump: [{ source: "a" }],
    attack: [{ source: "rt" }, { source: "rb" }],
    grab: [{ source: "x" }, { source: "lb" }, { source: "lt" }],
    throw: [{ source: "b" }],
    special: [{ source: "y" }],
  },
}
```

Why the `scale: -1` entries matter:

- Browser gamepad axes report stick up as negative.
- Stick Smash expects `moveY` and `aimY` up as positive.
- PFP `dpadY` also reports down as positive, so it needs the same inversion.

- [x] Include `statKeys`:

```ts
statKeys: {
  kills: { label: "Kills", scope: "player" },
  deaths: { label: "Deaths", scope: "player" },
  lives: { label: "Lives", scope: "player" },
}
```

- [x] Include presentation metadata for the shell library:

```ts
presentation: {
  category: "fighting",
  accent: "#ff3b6b",
  icon: "🥊",
  blurb: "Physics stick brawls with weapons, hazards, and last-player-standing chaos.",
}
```

---

## 5. Add a PFP Runtime Adapter

- [x] Add a small adapter area:

```text
games/stick-smash/src/pfp/PfpRuntime.js
games/stick-smash/src/input/PfpControls.js
games/stick-smash/src/pfp/results.js
```

- [x] In `PfpRuntime.js`, create the SDK and control clients:

```js
import { createGameClient } from "@pfp/sdk";
import { createControlClient } from "@pfp/controls";

export function createPfpRuntime() {
  const client = createGameClient();
  const controls = createControlClient(client);
  return { client, controls };
}
```

- [x] In `src/main.js`, initialize PFP mode without breaking standalone mode:
  - Initialize Rapier.
  - Create `Game`.
  - Register `client.onLaunch(...)`.
  - Call `client.ready()` after the game can receive launch.
  - In standalone mode, leave the upstream menu flow intact.

Target shell lifecycle:

```text
boot
  -> initRapier()
  -> new Game({ pfpRuntime })
  -> client.ready()
  -> client.onLaunch(context)
  -> game.startPfpMatch(context)
  -> game calls client.gameOver(result)
```

---

## 6. Add Shell Launch Mode to Stick Smash

- [x] Add `Game.startPfpMatch(context)` or equivalent.
- [x] Store the PFP launch context:

```js
this._pfp = {
  context,
  sessionId: context.sessionId,
  startedAt: Date.now(),
};
```

- [x] Start a local match directly from the PFP player list.
- [x] Do not rely on `navigator.getGamepads()` for PFP-launched players.
- [x] Assign each local player an input source like:

```js
inputSource: { kind: "pfp", slot: player.slot }
```

- [x] Preserve profile display names:

```js
name: player.displayName || `P${player.slot + 1}`
```

- [x] Choose character assignment.
  - Initial simple path: assign from the Stick Smash roster in slot order.
  - Later polish: add shell settings or character select.
- [x] Choose level assignment.
  - Initial simple path: use `arena`.
  - Later polish: add shell launch settings.
- [x] Set `bots: 0` for shell multiplayer unless explicitly testing bot fill.
- [x] Hide the upstream menu in PFP mode when a shell match starts.
- [x] Keep HUD, countdown, kill feed, and match visuals.

---

## 7. Add the Forwarded Controls Adapter

- [x] Implement `PfpControls.getSnapshotForSlot(slot)`.
- [x] Read the latest `ControlFrame` from `@pfp/controls`.
- [x] Return a neutral Stick Smash snapshot when no frame/player exists.
- [x] Convert action values to Stick Smash's input shape:

```js
{
  moveX: actions.moveX?.value ?? 0,
  moveY: actions.moveY?.value ?? 0,
  jump: actions.jump?.pressed ?? false,
  attack: actions.attack?.pressed ?? false,
  grab: actions.grab?.pressed ?? false,
  special: actions.special?.pressed ?? false,
  throw: actions.throw?.pressed ?? false,
  aimX,
  aimY,
  aimActive
}
```

- [x] Set `aimActive` only when right-stick magnitude is meaningful:

```js
const aimActive = Math.hypot(aimX, aimY) > 0.35;
```

- [x] Extend `InputManager.getSnapshotFor(source)`:

```js
if (source.kind === "pfp") return this.pfpControls.getSnapshotForSlot(source.slot);
```

- [x] Add a way to inject the PFP controls adapter into `InputManager`.
  - Prefer constructor injection or a setter over importing SDK code directly in
    `Input.js`.

---

## 8. Report Shell Results

- [x] Add a hook in `Game._checkGameOver()` before the upstream over-screen path:

```js
this.onPfpGameOver?.({
  winner,
  players: this.players,
  reason: "victory",
});
```

- [x] Also call the hook for draw and KO outcomes.
- [x] Ensure the hook fires once.
- [x] In PFP mode, call `client.gameOver(...)` instead of leaving the player on
  Stick Smash's own over menu.
- [x] Convert Stick Smash players to PFP standings.

Ranking rule:

- Winner forced to rank `1` when there is a winner.
- Then sort by:
  - Higher `lives`.
  - Higher `score`.
  - Lower `deaths`.

Standing shape:

```js
{
  slot,
  profileId,
  rank,
  score: player.score,
  stats: {
    kills: player.score,
    deaths: player.deaths,
    lives: player.lives,
  },
}
```

Game result shape:

```js
client.gameOver({
  gameId: "stick-smash",
  sessionId: context.sessionId,
  startedAt,
  endedAt: Date.now(),
  standings,
  gameStats: {
    durationMs: Date.now() - startedAt,
    reason,
  },
});
```

---

## 9. Wire It Into the Shell Catalog

- [x] Replace the disabled `stickFightPlaceholder` in
  `apps/shell/src/games.ts`.
- [x] Import the manifest:

```ts
import stickSmashManifest from "../../../games/stick-smash/game.manifest.js";
```

- [x] Add `toGameEntry(stickSmashManifest)` in the `GAMES` list.
- [x] Add a thumbnail at:

```text
apps/shell/public/thumbnails/stick-smash.png
```

- [x] Update the root `package.json` dev script to include:

```text
--filter @pfp/stick-smash
```

- [x] Add `stick-smash` to `BUILT_GAME_IDS` in
  `apps/shell/src/buildGames.ts` only after the production build succeeds.

---

## 10. Tests

- [x] Add `games/stick-smash/test/pfpControls.test.ts`.
- [x] Test neutral input when no frame exists.
- [x] Test movement axis mapping:
  - left stick right -> positive `moveX`.
  - left stick up -> positive `moveY`.
  - d-pad up -> positive `moveY`.
- [x] Test aim mapping:
  - right stick right -> positive `aimX`.
  - right stick up -> positive `aimY`.
  - low magnitude aim -> `aimActive: false`.
- [x] Test buttons:
  - A -> `jump`.
  - RT/RB -> `attack`.
  - X/LB/LT -> `grab`.
  - B -> `throw`.
  - Y -> `special`.
- [x] Add `games/stick-smash/test/resultAdapter.test.ts`.
- [x] Test winner ranks first.
- [x] Test sort fallback by lives, kills, deaths.
- [x] Test every launched PFP player gets a standing.

---

## 11. Build and Verification

- [x] Install dependencies after adding the package:

```sh
pnpm install
```

- [x] Run focused checks:

```sh
pnpm --filter @pfp/stick-smash typecheck
pnpm --filter @pfp/stick-smash build
```

- [x] Run repo checks:

```sh
pnpm test
pnpm build
```

- [ ] Manual shell smoke test:
  - Start shell and game dev servers.
  - Pair two controllers.
  - Launch Stick Smash from the shell.
  - Verify P1 and P2 movement.
  - Verify aim, jump, attack, grab, throw, and special.
  - Press Start and verify the shell pause overlay opens.
  - Finish a match and verify the shell Results screen receives standings.
  - Relaunch and verify no stale iframe/game state persists.

- [ ] Manual standalone smoke test:
  - Run only the Stick Smash dev server.
  - Verify the upstream menu still appears.
  - Verify direct keyboard/gamepad controls still work if hybrid mode is kept.

---

## 12. Risks and Guardrails

- [x] Do not rewrite `packages/controls` unless a concrete adapter bug proves it
  is necessary.
- [x] Do not change control behavior for Pong, Space Invaders, Raskulls, or Iron
  Yard during this integration.
- [x] Keep PFP mode additive. Avoid deleting upstream online/local flows until
  there is a deliberate product decision to remove standalone behavior.
- [x] Watch for absolute paths from upstream import maps. Anything like
  `/src/...` must become package-relative or Vite-resolved under
  `/games/stick-smash/`.
- [x] PeerJS is only needed for upstream standalone online mode. If PFP mode
  never exposes online play, it can remain as a dependency for standalone mode
  or be deferred behind dynamic import later.
- [x] Rapier WASM loading can be slow on cold start. Keep the shell in loading
  state until `client.ready()` is called.

---

## 13. Definition of Done

- [x] `Stick Smash` appears as an enabled game in the shell.
- [x] Shell pairing determines the active players.
- [x] The game launches without showing its own setup menu in shell mode.
- [x] Every paired player controls exactly one stick fighter.
- [x] Shell pause/quit works.
- [x] Match end returns to the shell Results screen.
- [x] Results include rank, score, kills, deaths, and lives for every player.
- [x] `pnpm test` passes.
- [x] `pnpm build` passes.
- [x] License/permission status is documented in the repo.
