# Adding a Game to PFP-FF

This document is everything you need to build a game that runs inside the
shell. There is no framework requirement — any web page that can run in an
iframe and speak the postMessage contract below is a valid game.

The current supported paths are **SDK-only** and **shell-forwarded controls**:
a game imports `@pfp/sdk`, handles the lifecycle, and reports a result; it can
either read its own input or receive normalized control frames from the shell.
Before implementing a new game, fill out
[`GAME_SPEC_TEMPLATE.md`](GAME_SPEC_TEMPLATE.md) so controls, scoring, result
data, and out-of-scope items are explicit.
The planned game-kit path is documented in
[`SHELL_ARCHITECTURE_IMPLEMENTATION_PLAN.md`](SHELL_ARCHITECTURE_IMPLEMENTATION_PLAN.md):

- **SDK-only custom game:** best for Phaser, Three.js, Godot exports, or unusual
  engines.
- **Shell-forwarded controls game:** supported infrastructure where the shell
  sends normalized control frames so the game does not poll devices directly.
  See [`CONTROLS.md`](CONTROLS.md).
- **Game-kit game:** planned starter runtime for small canvas games and future
  AI-generated games.

---

## 1. File structure

Create a folder under `games/`:

For SDK-only custom games, start by copying `games/_template-sdk/`. It shows
raw SDK lifecycle handlers, direct keyboard/gamepad input, pause/resume,
terminate cleanup, and `GameResult` reporting. Replace the template tokens:
`__GAME_ID__`, `__GAME_NAME__`, `__PACKAGE_NAME__`, `__DEV_PORT__`, and
`__PREVIEW_PORT__`.

```
games/
  your-game/
    game.manifest.ts ← metadata the shell uses for library + launch
    index.html      ← the page the shell loads in an iframe
    src/main.ts     ← your entry point (or plain JS, or anything Vite can build)
    package.json    ← needed for workspace builds/dev scripts
    tsconfig.json   ← needed for TypeScript games
    vite.config.ts  ← only needed if you want a build step
```

If your game is a single HTML file with inline `<script>` tags you don't need
Vite at all. If it has TypeScript or dependencies, add a minimal Vite config:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "/games/your-game/",
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5179, strictPort: true },
});
```

---

## 2. Add the game manifest

Add `games/your-game/game.manifest.ts`:

```ts
import type { GameManifest } from "@pfp/sdk";

const manifest = {
  id: "your-game", // kebab-case, must be unique
  name: "Your Game",
  version: "0.1.0",
  engine: "web", // "web" for TypeScript/HTML games
  entry: "/games/your-game/index.html",
  players: { min: 2, max: 4 },
  sdk: "^1.0.0",
  tags: ["party"],
  input: { mode: "direct" },
  presentation: {
    category: "party",
    accent: "#c084fc",
    icon: "🎮",
    blurb: "One short sentence for the shell library.",
  },
  build: {
    packageName: "@pfp/your-game",
    devPort: 5179,
    built: true,
  },
} satisfies GameManifest;

export default manifest;
```

After adding a manifest, regenerate the shell catalog:

```sh
pnpm generate:game-catalog
```

This updates `apps/shell/src/games.generated.ts`, which is the generated list
consumed by `apps/shell/src/games.ts`. Do not edit the generated file by hand.
Use the check command before committing to catch stale catalog output:

```sh
pnpm check:game-catalog
```

For an enabled production game, also add the id to `BUILT_GAME_IDS` in
`apps/shell/src/buildGames.ts`. The shell build copies only those game `dist/`
folders into `apps/shell/dist/games/*`.

For local development, either run the game's dev server separately:

```sh
pnpm --filter @pfp/your-game dev
```

or add it to the root `pnpm dev` filters if you want it to start with the shell.
The shell uses `manifest.build.devPort` to point at that dev server.

**No win condition?** Set `session: { endless: true }` in the manifest. The
shell won't expect a `GameResult` on request-exit — see §7.

**Need a local server process?** Set `build.desktopServer` to
`{ command, cwd, healthCheckUrl, port }` and the Electron desktop shell
(`apps/desktop`) will spawn and tear it down around each session, passing the
resolved URL to your game as `LaunchContext.settings.serverUrl`. This only
works in the desktop shell — see `docs/ARCHITECTURE.md` §5.7. Games declaring
it are shown as unavailable in plain-browser mode.

---

## 3. The game lifecycle

The shell and your game talk through `postMessage`. The flow is always:

```
Game loads
  → game calls ready()
  → shell sends launch(context)   ← you get player list + gamepad indices here
Game plays...
  → game calls gameOver(result)
  → shell records the result and returns to the menu
```

You never call `postMessage` directly. Import the SDK client which wraps it:

```ts
import { createGameClient } from "@pfp/sdk";

const client = createGameClient(); // automatically talks to the parent window

client.onLaunch((context) => {
  // context tells you who is playing and which controller they're on
  startGame(context);
});

// Once your assets are loaded and you're ready to receive launch:
client.ready();
```

When the game ends:

```ts
client.gameOver({
  gameId: "your-game",
  sessionId: context.sessionId, // pass back what you received in launch
  startedAt: matchStartTime, // epoch ms
  endedAt: Date.now(), // epoch ms
  standings: [
    { slot: 0, profileId: context.players[0].profileId, rank: 1, score: 11 },
    { slot: 1, profileId: context.players[1].profileId, rank: 2, score: 7 },
  ],
});
```

The shell handles routing to the Results screen — you don't navigate away.

---

## 4. The `LaunchContext` object

```ts
interface LaunchContext {
  sessionId: string; // unique per match, pass it back in GameResult
  sdkVersion: string; // "1.0.0"
  players: PlayerSlot[];
  settings: Record<string, unknown>; // reserved, ignore for now
}

interface PlayerSlot {
  slot: number; // 0 = P1, 1 = P2, etc.
  profileId: string | null; // null = guest
  displayName: string; // e.g. "Ann" or "P1"
  color: string; // hex colour assigned to this player, e.g. "#ef4444"
  gamepadIndex: number; // pass to navigator.getGamepads()[gamepadIndex]
}
```

`context.players.length` tells you how many people joined the lobby. The
`slot` numbers are stable (gaps fill from the bottom) but not necessarily
contiguous if someone left and rejoined.

---

## 5. Reading controller input directly

Direct input is still a good default for custom engines and games that need raw
device state. The Gamepad API is available inside the iframe; use
`gamepadIndex` from each player slot:

```ts
function readInput(gamepadIndex: number) {
  const pad = navigator.getGamepads()[gamepadIndex];
  if (!pad) return null;
  return pad;
}
```

Button layout (W3C standard mapping, all Xbox controllers):

| Index | Name    | Xbox label                 |
| ----- | ------- | -------------------------- |
| 0     | A       | A (bottom face)            |
| 1     | B       | B (right face)             |
| 2     | X       | X (left face)              |
| 3     | Y       | Y (top face)               |
| 4     | LB      | Left bumper                |
| 5     | RB      | Right bumper               |
| 6     | LT      | Left trigger (analog 0–1)  |
| 7     | RT      | Right trigger (analog 0–1) |
| 8     | Back    | View / Back                |
| 9     | Start   | Menu / Start               |
| 12    | D-Up    | D-pad up                   |
| 13    | D-Down  | D-pad down                 |
| 14    | D-Left  | D-pad left                 |
| 15    | D-Right | D-pad right                |

Axes: `pad.axes[0]` = left stick X, `pad.axes[1]` = left stick Y,
`pad.axes[2]` = right stick X, `pad.axes[3]` = right stick Y.
All axes are −1 to +1; apply a deadzone (~0.15) yourself.

Poll inside your game loop — the Gamepad API is snapshot-based:

```ts
function gameTick() {
  for (const player of context.players) {
    const pad = navigator.getGamepads()[player.gamepadIndex];
    if (!pad) continue;
    // read pad.buttons[0].pressed, pad.axes[0], etc.
  }
  requestAnimationFrame(gameTick);
}
```

---

## 6. Receiving shell-forwarded controls

If your manifest uses `input.mode: "forwarded"` or `"hybrid"`, the shell creates
a control forwarder for the game. Direct-input games do not receive frames.
Pong currently uses `"hybrid"` as the reference migration path: shell-forwarded
frames in the shell, with direct input kept as a standalone-dev fallback.

Manifest example:

```ts
input: {
  mode: "forwarded",
  actions: {
    move: [{ source: "leftStickX", deadzone: 0.2 }],
    jump: [{ source: "a" }],
    fire: [{ source: "rt" }],
  },
}
```

Game-side usage:

```ts
import { createGameClient } from "@pfp/sdk";
import { createControlClient } from "@pfp/controls";

const client = createGameClient();
const controls = createControlClient(client);

controls.onFrame((frame) => {
  const p1 = frame.players.find((player) => player.slot === 0);
  if (!p1) return;

  const moveX = p1.actions.move?.value ?? 0;
  const jump = p1.actions.jump?.justPressed ?? false;
  const fire = p1.actions.fire?.pressed ?? false;
});

client.ready();
```

For simple games, prefer `forwarded` once the game can run inside the shell. For
custom engines that need raw browser input, use `direct`. Use `hybrid` during a
migration or when a game wants both shell-level actions and engine-specific raw
input.

---

## 7. The `GameResult` you must send back

```ts
interface GameResult {
  gameId: string; // must match the manifest id
  sessionId: string; // from LaunchContext.sessionId
  startedAt: number; // epoch ms, when play began
  endedAt: number; // epoch ms, now
  standings: PlayerStanding[];
  gameStats?: Record<string, unknown>; // any freeform match-level data
  achievements?: string[]; // optional game-detected achievement ids
}

interface PlayerStanding {
  slot: number; // from PlayerSlot.slot
  profileId: string | null; // from PlayerSlot.profileId
  rank: number; // 1 = winner; ties share a rank (both get rank 1)
  score?: number; // optional numeric score shown on the results screen
  stats?: Record<string, number>; // optional freeform per-player stats
}
```

Rules:

- Every player who played must have a `PlayerStanding` (even if they quit early — give them last place).
- `rank` starts at 1. Ties are fine: if two players draw, both get `rank: 1` and there is no `rank: 2`.
- `score` is optional but will be shown on the results screen if provided.

**Endless games** (`session: { endless: true }` in the manifest) don't have a
ranking to report. Skip `gameOver()` entirely — just call `client.requestExit()`
when a player quits, same as §8 below. The shell returns straight to the
library without a results screen or a match record.

---

## 8. Optional: other lifecycle events

```ts
client.onPause(() => {
  // Shell asked you to pause (e.g. a player disconnected their controller).
  // Freeze your game loop.
});

client.onResume(() => {
  // Resume.
});

client.onTerminate(() => {
  // Shell is force-closing the game (player held Back on the shell overlay).
  // Clean up and stop your loop. You do NOT call gameOver() here.
});

// If something goes unrecoverably wrong on your side:
client.reportError("canvas failed to initialise");

// If a player chooses "quit" from an in-game menu:
client.requestExit();
```

---

## 9. Minimal working example

A complete single-file game that immediately ends in a P1 win:

```html
<!doctype html>
<html>
  <body
    style="background:#000;color:#fff;font-family:sans-serif;display:grid;place-items:center;height:100vh"
  >
    <p id="msg">Loading…</p>
    <script type="module">
      // In a real game you'd: import { createGameClient } from "@pfp/sdk";
      // For a self-contained file, paste the tiny shim below instead.
      const CHANNEL = "pfp";
      function post(type, payload) {
        window.parent.postMessage({ channel: CHANNEL, type, payload }, "*");
      }
      function listen(handler) {
        window.addEventListener("message", (e) => {
          if (e.data?.channel === CHANNEL) handler(e.data);
        });
      }

      let ctx = null;
      const startedAt = Date.now();

      listen((msg) => {
        if (msg.type === "launch") {
          ctx = msg.payload;
          document.getElementById("msg").textContent =
            `Playing with ${ctx.players.map((p) => p.displayName).join(" vs ")}`;

          // Pretend we played a 3-second game, then P1 wins.
          setTimeout(() => {
            post("gameOver", {
              gameId: "your-game",
              sessionId: ctx.sessionId,
              startedAt,
              endedAt: Date.now(),
              standings: ctx.players.map((p, i) => ({
                slot: p.slot,
                profileId: p.profileId,
                rank: i + 1,
                score: 10 - i * 3,
              })),
            });
          }, 3000);
        }
      });

      post("ready", { sdkVersion: "1.0.0" });
    </script>
  </body>
</html>
```

---

## 10. Using the TypeScript SDK (recommended)

If your game has a build step, import the SDK package directly — it handles
the postMessage boilerplate and gives you full types:

```ts
// games/your-game/src/main.ts
import { createGameClient, type LaunchContext } from "@pfp/sdk";

const client = createGameClient();
let context: LaunchContext;
let startedAt: number;

client.onLaunch((ctx) => {
  context = ctx;
  startedAt = Date.now();
  startGameLoop();
});

client.ready(); // tell the shell we're ready

function endGame(winnerSlot: number) {
  const sorted = context.players.slice().sort((a, b) => (a.slot === winnerSlot ? -1 : 1));

  client.gameOver({
    gameId: "your-game",
    sessionId: context.sessionId,
    startedAt,
    endedAt: Date.now(),
    standings: sorted.map((p, i) => ({
      slot: p.slot,
      profileId: p.profileId,
      rank: i + 1,
    })),
  });
}
```

In `games/your-game/package.json`:

```json
{
  "name": "@pfp/your-game",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5179",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0 --port 4179",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pfp/sdk": "workspace:*"
  }
}
```

Add `"@pfp/controls": "workspace:*"` only if the game uses shell-forwarded
controls.

In `games/your-game/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "types": ["vitest/globals"]
  },
  "include": ["src", "test", "vite.config.ts"]
}
```

---

## Summary checklist

- [ ] `games/your-game/index.html` exists and is served at that path
- [ ] `games/your-game/game.manifest.ts` exists and uses `satisfies GameManifest`
- [ ] `games/your-game/package.json` has `dev`, `build`, and `typecheck` scripts
- [ ] Manifest wired into `apps/shell/src/games.ts` until catalog generation exists
- [ ] Enabled production game id added to `apps/shell/src/buildGames.ts`
- [ ] Root `pnpm dev` updated, or the game dev server is started separately
- [ ] Game calls `client.ready()` (or posts `{ channel:"pfp", type:"ready", payload:{sdkVersion:"1.0.0"} }`)
- [ ] Game handles the `launch` message and starts only then
- [ ] Game handles `pause`, `resume`, and `terminate`
- [ ] If using forwarded controls, manifest `input.mode` is `forwarded` or `hybrid`
- [ ] Game calls `client.gameOver(result)` with a standing for every player
- [ ] `result.gameId` matches the manifest `id`
- [ ] `result.sessionId` matches `context.sessionId`
- [ ] Every player has a `rank` (1 = winner)
