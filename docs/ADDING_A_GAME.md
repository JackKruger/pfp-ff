# Adding a Game to PFP-FF

This document is everything you need to build a game that runs inside the
shell. There is no framework requirement — any web page that can run in an
iframe and speak the postMessage contract below is a valid game.

---

## 1. File structure

Create a folder under `games/`:

```
games/
  your-game/
    index.html      ← the page the shell loads in an iframe
    game.ts         ← your entry point (or plain JS, or anything Vite can build)
    vite.config.ts  ← only needed if you want a build step
```

If your game is a single HTML file with inline `<script>` tags you don't need
Vite at all. If it has TypeScript or dependencies, add a minimal Vite config:

```ts
// games/your-game/vite.config.ts
import { defineConfig } from "vite";
export default defineConfig({ base: "/games/your-game/" });
```

---

## 2. Register the game with the shell

Add one entry to `apps/shell/src/games.ts`:

```ts
{
  id: "your-game",          // kebab-case, must be unique
  name: "Your Game",
  version: "0.1.0",
  engine: "web",            // always "web" for TypeScript/HTML games
  entry: "/games/your-game/index.html",
  players: { min: 2, max: 4 },  // how many players your game supports
  sdk: "^1.0.0",
  tags: ["party"],          // optional, shown on the card
}
```

That's it — the shell will show the game in the menu and know how to launch it.

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
  sessionId: context.sessionId,   // pass back what you received in launch
  startedAt: matchStartTime,      // epoch ms
  endedAt: Date.now(),            // epoch ms
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
  sessionId: string;       // unique per match, pass it back in GameResult
  sdkVersion: string;      // "1.0.0"
  players: PlayerSlot[];
  settings: Record<string, unknown>;  // reserved, ignore for now
}

interface PlayerSlot {
  slot: number;            // 0 = P1, 1 = P2, etc.
  profileId: string | null;// null = guest
  displayName: string;     // e.g. "Ann" or "P1"
  color: string;           // hex colour assigned to this player, e.g. "#ef4444"
  gamepadIndex: number;    // pass to navigator.getGamepads()[gamepadIndex]
}
```

`context.players.length` tells you how many people joined the lobby. The
`slot` numbers are stable (gaps fill from the bottom) but not necessarily
contiguous if someone left and rejoined.

---

## 5. Reading controller input

The shell does **not** forward controller events to you — the Gamepad API is
available directly inside the iframe. Use `gamepadIndex` from the player slot:

```ts
function readInput(gamepadIndex: number) {
  const pad = navigator.getGamepads()[gamepadIndex];
  if (!pad) return null;
  return pad;
}
```

Button layout (W3C standard mapping, all Xbox controllers):

| Index | Name    | Xbox label       |
|-------|---------|------------------|
| 0     | A       | A (bottom face)  |
| 1     | B       | B (right face)   |
| 2     | X       | X (left face)    |
| 3     | Y       | Y (top face)     |
| 4     | LB      | Left bumper      |
| 5     | RB      | Right bumper     |
| 6     | LT      | Left trigger (analog 0–1) |
| 7     | RT      | Right trigger (analog 0–1)|
| 8     | Back    | View / Back      |
| 9     | Start   | Menu / Start     |
| 12    | D-Up    | D-pad up         |
| 13    | D-Down  | D-pad down       |
| 14    | D-Left  | D-pad left       |
| 15    | D-Right | D-pad right      |

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

## 6. The `GameResult` you must send back

```ts
interface GameResult {
  gameId: string;           // must match the id in games.ts
  sessionId: string;        // from LaunchContext.sessionId
  startedAt: number;        // epoch ms, when play began
  endedAt: number;          // epoch ms, now
  standings: PlayerStanding[];
  gameStats?: Record<string, unknown>;  // any freeform match-level data
}

interface PlayerStanding {
  slot: number;             // from PlayerSlot.slot
  profileId: string | null; // from PlayerSlot.profileId
  rank: number;             // 1 = winner; ties share a rank (both get rank 1)
  score?: number;           // optional numeric score shown on the results screen
  stats?: Record<string, number>;  // optional freeform per-player stats
}
```

Rules:
- Every player who played must have a `PlayerStanding` (even if they quit early — give them last place).
- `rank` starts at 1. Ties are fine: if two players draw, both get `rank: 1` and there is no `rank: 2`.
- `score` is optional but will be shown on the results screen if provided.

---

## 7. Optional: other lifecycle events

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

## 8. Minimal working example

A complete single-file game that immediately ends in a P1 win:

```html
<!doctype html>
<html>
<body style="background:#000;color:#fff;font-family:sans-serif;display:grid;place-items:center;height:100vh">
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
          `Playing with ${ctx.players.map(p => p.displayName).join(" vs ")}`;

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

## 9. Using the TypeScript SDK (recommended)

If your game has a build step, import the SDK package directly — it handles
the postMessage boilerplate and gives you full types:

```ts
// games/your-game/game.ts
import { createGameClient } from "@pfp/sdk";

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
  const sorted = context.players
    .slice()
    .sort((a, b) => (a.slot === winnerSlot ? -1 : 1));

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
  "private": true,
  "type": "module",
  "dependencies": {
    "@pfp/sdk": "workspace:*"
  }
}
```

---

## Summary checklist

- [ ] `games/your-game/index.html` exists and is served at that path
- [ ] Entry added to `apps/shell/src/games.ts` with matching `id` and `entry`
- [ ] Game calls `client.ready()` (or posts `{ channel:"pfp", type:"ready", payload:{sdkVersion:"1.0.0"} }`)
- [ ] Game handles the `launch` message and starts only then
- [ ] Game calls `client.gameOver(result)` with a standing for every player
- [ ] `result.gameId` matches the `id` in the registry
- [ ] `result.sessionId` matches `context.sessionId`
- [ ] Every player has a `rank` (1 = winner)
