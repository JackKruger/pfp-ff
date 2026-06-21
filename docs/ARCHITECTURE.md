# PFP-FF — Couch Multiplayer Game Platform

**Architecture & Implementation Plan**

Status: Draft v0.1 — for review/iteration before code.

---

## 1. Vision

A "console-like" shell that runs on one screen, where 1–4 friends grab Xbox
controllers and play a library of simple, fun couch games — clones and
originals (Stick-Fight-style brawlers, a Smash-style platform fighter, a mini
Mario-Party, party/minigame stuff). Profiles persist across sessions and the
platform tracks long-term scores and stats. New games — ours or friends' —
plug in through a single, stable contract.

### Goals
- **Plug-in games, not a monolith.** Adding a game should be cheap and require
  near-zero changes to the shell.
- **One contract, multiple engines.** Native TypeScript games *and* Godot games
  (via HTML5 export) plug into the *same* socket.
- **Local-first.** Everything runs on one machine; no accounts or internet
  required. Cloud sync is a later, optional add-on behind the same data layer.
- **Controller-native.** The whole UI is drivable with an Xbox controller — no
  keyboard/mouse needed once you're on the couch.
- **Portable runtime.** Runs in a browser today; wrappable in Tauri/Electron
  later for a kiosk "boot-into-it" HTPC feel. No lock-in.

### Non-goals (for now)
- Online / netcode multiplayer (this is *couch* co-op — same room, one screen).
- Accounts, auth, matchmaking.
- A storefront / dynamic download system. Games are bundled.

---

## 2. Core concepts

| Term | Meaning |
|------|---------|
| **Shell** | The launcher app: game grid, profile select, controller pairing, stats, and the in-game host frame. |
| **Game** | A plugin loaded by the shell into a sandboxed iframe. Native-TS or Godot-web-export. |
| **Contract / SDK** | The versioned message protocol + types + helper libs that shell and games communicate through. The most important artifact in the repo. |
| **Profile** | A persistent player identity: name, color, avatar. |
| **Slot** | A player position in a match (P1–P4), bound to one controller and (optionally) one profile. |
| **Match record** | The immutable result of one game played, the source of truth for all stats. |

---

## 3. High-level architecture

```
┌──────────────────────────────────────────────────────────────┐
│                          SHELL (web app)                       │
│                                                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │ Game grid  │  │  Profiles  │  │  Pairing   │  │  Stats   │ │
│  │   (menu)   │  │  select    │  │   lobby    │  │ screens  │ │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘ │
│         │              │               │              │        │
│  ┌──────┴──────────────┴───────────────┴──────────────┴─────┐ │
│  │  Input service   │   Data layer   │   SDK host (launcher) │ │
│  │ (gamepads,       │ (profiles +    │  postMessage bridge   │ │
│  │  pairing, hot-   │  match records)│  + lifecycle          │ │
│  │  plug)           │                │                       │ │
│  └──────────────────────────────────┬────────────────────────┘ │
│                                      │ launch / lifecycle        │
│                            ┌─────────┴─────────┐                  │
│                            │   GAME (iframe)    │                  │
│                            │  native-TS  | Godot│                  │
│                            │  uses @pfp/sdk      │                  │
│                            └────────────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

The shell and each game live in **separate iframes** and only ever talk through
the SDK's `postMessage` contract. This gives us:
- **Isolation** — a buggy game can't take down the shell or other games.
- **Engine independence** — Godot exports and native games look identical to the
  host.
- **A clean coupling story** — first-party games also `import` shared packages
  directly (tighter), external games only need to speak the protocol (looser).
  That's the "hybrid" model.

---

## 4. Monorepo layout

```
pfp-ff/
├─ package.json              # pnpm workspace root
├─ pnpm-workspace.yaml
├─ docs/
│  └─ ARCHITECTURE.md        # this file
├─ packages/
│  ├─ sdk/                   # THE contract: types, game-side client, shell-side host
│  ├─ input/                 # controller service: polling, pairing, pad↔slot, hot-plug
│  ├─ data/                  # persistence: profiles + match records (IndexedDB now)
│  └─ ui/                    # shared UI: controller-focus navigation, theme, widgets
├─ apps/
│  └─ shell/                 # the launcher app (Vite)
└─ games/
   ├─ pong/                  # reference native-TS game — proves the contract
   ├─ _template-web/         # starter for new native-TS games
   └─ _template-godot/       # starter + shim for Godot HTML5 exports
```

**Tooling:** pnpm workspaces · TypeScript (strict) · Vite (build/dev) · ESLint +
Prettier · Vitest for unit tests.

---

## 5. The Game Contract (the heart of the system)

Everything else is replaceable; this is the part we design carefully and version.

### 5.1 Game manifest — `game.json`
Each game ships a manifest the shell uses to populate the grid and validate
player counts.

```jsonc
{
  "id": "pong",                 // unique, stable, kebab-case
  "name": "Pong",
  "version": "1.0.0",
  "engine": "web",              // "web" | "godot"
  "entry": "index.html",        // loaded into the iframe
  "players": { "min": 2, "max": 2 },
  "thumbnail": "thumb.png",
  "tags": ["arcade", "versus"],
  "sdk": "^1.0.0"               // contract version the game targets
}
```

### 5.2 Launch context — Shell → Game
When a game starts, the shell sends who's playing and which controller each slot
owns.

```ts
interface LaunchContext {
  sessionId: string;            // unique per match
  sdkVersion: string;
  players: PlayerSlot[];        // length within manifest min/max
  settings: Record<string, unknown>; // optional per-game options chosen in shell
}

interface PlayerSlot {
  slot: number;                 // 0..3  (P1..P4)
  profileId: string | null;     // null = guest
  displayName: string;
  color: string;                // hex, the player's identity color
  gamepadIndex: number;         // index into navigator.getGamepads()
}
```

### 5.3 Lifecycle messages

**Game → Shell**
| Message | Meaning |
|---------|---------|
| `ready` | Game has loaded and is waiting for `launch`. |
| `gameOver` | Match finished; carries a `GameResult`. Shell records it and returns to results screen. |
| `requestExit` | Player chose "quit to menu" from inside the game. |
| `error` | Unrecoverable game error; shell shows a fault screen and returns to menu. |

**Shell → Game**
| Message | Meaning |
|---------|---------|
| `launch` | Carries `LaunchContext`; start the match. |
| `pause` / `resume` | Shell-driven pause (e.g. controller disconnect overlay). |
| `terminate` | Shell is tearing the game down now. |

A minimal handshake: game loads → `ready` → shell sends `launch` → game runs →
`gameOver`.

### 5.4 Result & stats schema — the normalizing insight

The trick that lets the platform understand *every* game without knowing its
rules: **every match reduces to a ranking plus optional per-player stats.**

```ts
interface GameResult {
  gameId: string;
  sessionId: string;
  startedAt: number;            // epoch ms
  endedAt: number;
  standings: PlayerStanding[];  // who placed where
  gameStats?: Record<string, unknown>; // freeform, game-defined match-level data
}

interface PlayerStanding {
  slot: number;
  profileId: string | null;
  rank: number;                 // 1 = winner; ties share a rank
  score?: number;               // optional numeric score
  stats?: Record<string, number>; // game-defined per-player: kills, coins, ...
}
```

- Pong → `rank` by points, `score` = points.
- Smash clone → `rank` by last-alive order, `stats: { kos, falls }`.
- Mario Party → `rank` by stars, `stats: { stars, coins, minigamesWon }`.

The shell computes **generic** leaderboards (games played, wins, win-rate, best
score) from `rank`/`score` alone, while still storing rich `stats` for
game-specific screens later.

### 5.5 Versioning
The contract is semver'd (`sdkVersion`). The host checks a game's `sdk` range in
its manifest and warns on mismatch. Additive changes = minor; breaking changes =
major with a compatibility shim where feasible.

---

## 6. Input / controller system (`@pfp/input`)

The genuinely tricky, couch-specific part — built once, shared by everything.

- **Source:** the browser **Gamepad API** (`navigator.getGamepads()`), polled
  each animation frame. Xbox controllers map cleanly to the "standard" gamepad
  layout.
- **Normalization layer:** wrap raw axes/buttons into a stable scheme
  (`a b x y`, dpad, `lstick/rstick`, `lb rb lt rt`, `start back`) with
  edge-detection helpers (`justPressed`, `justReleased`) so games and the menu
  don't each reinvent it.
- **Pairing lobby:** unassigned controllers show *"Press A to join."* Pressing A
  claims the next free slot (P1–P4); pressing B leaves. Then each joined slot
  picks a profile (or "Guest").
- **Pad ↔ slot assignment** is owned by the shell and passed to the game in
  `LaunchContext`. In-game, a game reads its assigned `gamepadIndex` directly
  (or via an SDK input helper).
- **Hot-plug / disconnect:** listen to `gamepadconnected` /
  `gamepaddisconnected`. Mid-match disconnect → shell sends `pause` and shows a
  *"Controller N disconnected — reconnect to continue"* overlay; reconnect →
  `resume`.

> **Known risk:** Gamepad API quirks vary by OS/browser/controller (button
> mapping, rumble support is limited/inconsistent). Mitigation: the
> normalization layer + a small "controller test" screen, and validate early on
> the real target hardware.

---

## 7. Profiles & persistence (`@pfp/data`)

**Local-first**, with a `DataStore` interface so the backend can later swap from
IndexedDB → Tauri file/SQLite → cloud sync without touching callers.

```ts
interface Profile {
  id: string;
  name: string;
  color: string;        // identity color
  avatar?: string;      // emoji or asset id to start; image later
  createdAt: number;
  lastPlayedAt: number;
}

// Source of truth: one immutable record per game played.
interface MatchRecord {
  id: string;
  gameId: string;
  playedAt: number;
  standings: PlayerStanding[];
  gameStats?: Record<string, unknown>;
}
```

- **Match records are the source of truth.** All aggregate stats (per-profile
  per-game: played / won / win-rate / best score, plus all-time totals) are
  **derived** by querying records — never stored as the primary copy. This keeps
  stats correct and lets us add new derived views without migrations.
- **Storage now:** IndexedDB (via a thin `idb` wrapper) — survives sessions, no
  server.
- **Later:** export/import (a JSON backup), then optional cloud sync — both sit
  behind the same `DataStore`.

---

## 8. Shell UI (`apps/shell`, `@pfp/ui`)

**Screens**
1. **Home / game grid** — browse the library; shows each game's player-count.
2. **Profile select / pairing lobby** — "press A to join", pick profiles per
   slot.
3. **Game host** — the iframe + the SDK host bridge; pause/disconnect overlays.
4. **Results** — post-match standings, "rematch" / "back to menu".
5. **Profiles management** — create/edit/delete profiles.
6. **Stats** — per-profile and per-game leaderboards built from match records.

**Controller-driven navigation:** a small spatial/focus manager so D-pad/stick
moves focus between elements, A = select, B = back. Lives in `@pfp/ui` so every
screen uses it consistently.

**Stack:** React + a lightweight state store (Zustand) for the shell, with the
custom gamepad-focus layer. (React is for the *menu UI only* — games render
however they want; see §10.)

---

## 9. Game integration paths

All three speak the same contract; they differ only in how they're built.

1. **Native TypeScript game** — a small Vite app importing `@pfp/sdk`'s game
   client. Renders to its own canvas/WebGL however it likes. Start from
   `games/_template-web/`.
2. **Godot game** — built in the Godot editor, **exported to HTML5/WebAssembly**.
   A ~20-line JS shim bridges Godot signals ↔ SDK `postMessage`. Start from
   `games/_template-godot/`. To the shell it's indistinguishable from a native
   game.
3. **External / friends' games** — any web bundle that speaks the protocol drops
   into `games/` with a `game.json`. No shell changes needed.

> **Vibecoding note:** logic-driven games (Pong, snake, button-mashers) I can
> build end-to-end. For anything visual/feel-heavy — in either native canvas
> *or* Godot — I scaffold the logic and you do the polish loop (run it, send
> screenshots, tweak). This is an engine-agnostic limitation, not Godot-specific.

---

## 10. Rendering: shared-screen vs split-screen

The platform is **render-agnostic** — it hands a game one iframe/canvas and up to
4 controller inputs; the *game* decides its camera.

- Stick Fight / Smash / Mario Party are **shared single-camera** — all players on
  one screen. That's the common case for our target genres.
- **Split-screen** (e.g. a racer or explorer) is a *per-game* implementation
  detail: the game draws N viewports itself. The platform neither imposes nor
  prevents it.

So "split screen" is a capability some games will use, not a platform-level
framework. Good — it keeps the contract simple.

---

## 11. Tech stack summary

| Concern | Choice | Why |
|--------|--------|-----|
| Language | TypeScript (strict) | Shared types across shell + games + SDK. |
| Monorepo | pnpm workspaces | Cheap local linking of packages. |
| Build/dev | Vite | Fast, simple per-app. |
| Shell UI | React + Zustand | Maintainable menu UI; small state. |
| Controller focus | custom (in `@pfp/ui`) | Spatial nav, no good off-the-shelf fit. |
| Game contract | custom `postMessage` SDK | The core asset; must stay engine-neutral. |
| Persistence | IndexedDB via `idb`, behind `DataStore` | Local-first, swappable later. |
| Physics (game-level) | per-game (e.g. planck/matter, or Godot) | Not the platform's concern. |
| Packaging | browser → Tauri/Electron later | Portable now, kiosk later. |
| Tests | Vitest | Contract + data-layer unit tests. |

---

## 12. Milestones

The **vertical slice** (Phases 1–5) is the priority: a full
`menu → pair → play → record → stats` loop. Everything after is "add games."

- **Phase 0 — Scaffold.** pnpm workspace, TS config, Vite, lint/format, empty
  packages. *Done when:* `pnpm dev` boots an empty shell.
- **Phase 1 — SDK contract.** `@pfp/sdk`: types, game client, shell host,
  versioning, + a mock harness to test the protocol without a real game.
  *Done when:* a stub game completes the `ready→launch→gameOver` handshake against
  the host in a test.
- **Phase 2 — Data layer.** `@pfp/data`: profiles + match records on IndexedDB
  behind `DataStore`; derived-stats queries. *Done when:* records persist across
  reloads and aggregates compute correctly (unit-tested).
- **Phase 3 — Input.** `@pfp/input`: gamepad polling, normalization, pairing
  lobby logic, hot-plug. *Done when:* 4 controllers can each join a slot and a
  "controller test" screen reflects inputs.
- **Phase 4 — Shell UI.** Game grid, profile mgmt, pairing screen, game host
  frame, results, stats — all controller-navigable. *Done when:* you can drive the
  whole shell with only a controller.
- **Phase 5 — Reference game: Pong.** Native-TS game through the real contract.
  *Done when:* the full loop works and a Pong result shows up in stats.
- **Phase 6 — Godot proof.** One Godot HTML5 export wired through the shim.
  *Done when:* a Godot game launches, reports a result, and is indistinguishable
  to the shell.
- **Phase 7 — Real games + polish.** A Smash-lite or Stick-Fight-lite, profile
  avatars, shell theming/sound, controller test screen polish.

---

## 13. Open questions / future

- **Cloud sync & online play** — explicitly out of scope now; the `DataStore`
  abstraction keeps the door open for sync.
- **Cross-game meta** — tournaments/brackets stringing minigames together (very
  Mario-Party); the `rank`-based result model already supports scoring this.
- **Unlocks / achievements** — derivable from match records later.
- **Rumble / haptics** — nice-to-have; Gamepad API support is inconsistent, so
  treat as best-effort.
- **Accessibility** — remappable buttons, colorblind-safe player colors.

---

## 14. Risks

| Risk | Mitigation |
|------|------------|
| Gamepad API inconsistencies across OS/browser/controller | Normalization layer; controller-test screen; validate on real hardware early. |
| Godot HTML5 export size / load time in an iframe | Measure in Phase 6; consider a loading screen and asset trimming. |
| Visual/"feel" polish needs a human in the loop | Plan for a run-screenshot-tweak cycle; I own logic, you own juice. |
| Contract churn breaking games | Semver the SDK; additive-by-default; compatibility checks in the host. |
| Scope creep into online/accounts | Hold the line on local-first non-goals until the couch loop is great. |
