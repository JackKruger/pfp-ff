# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PFP-FF is a **couch-multiplayer game platform**: a console-like shell where 1–4
friends use Xbox controllers to play a library of simple games on one screen.
Profiles and long-term stats persist locally across sessions. Games plug into
the shell through a single versioned `postMessage` contract, so native-TS games
and Godot (HTML5 export) games look identical to the host.

It is a **pnpm workspace monorepo** (Node ≥20, TypeScript strict, Vite, Vitest).

## Commands

```bash
pnpm install          # install all workspace deps (or run ./setup.sh)
pnpm dev              # run shell + raskulls/pong/space-invaders/iron-yard dev servers in parallel
pnpm build            # typecheck, then build packages → games → apps (ordered)
pnpm typecheck        # tsc --noEmit across every workspace package
pnpm test             # vitest run (all packages/games/apps)
pnpm format           # prettier --write .
pnpm format:check     # prettier --check .
```

Single test file / single test:

```bash
pnpm vitest run packages/sdk/test/handshake.test.ts
pnpm vitest run -t "name of the test"
pnpm vitest                 # watch mode
```

Run one workspace package's script with `--filter`:

```bash
pnpm --filter @pfp/shell dev
pnpm --filter @pfp/sdk test
```

Tests are discovered by `vitest.config.ts` at `{packages,games,apps}/**/test/**/*.test.ts`
(node environment). `pnpm build` is the gate — it runs `pnpm typecheck` first and
builds in dependency order (packages, then games, then apps).

## Workspace layout

- `packages/sdk` — **the contract**: message protocol, shared types, game-side
  client (`createGameClient`), shell-side host. The most important artifact in
  the repo; it is semver-versioned.
- `packages/input` — gamepad polling, normalization, pairing, hot-plug.
- `packages/controls` — optional shell-forwarded normalized input frames.
- `packages/data` — local profile + match-record persistence with derived stats.
- `packages/ui` — shared controller-focus navigation, theme, widgets (typecheck only).
- `packages/game-kit` — *planned*, not yet present.
- `apps/shell` — the launcher app (React + Zustand + Vite). Entry into everything.
- `games/{pong,space-invaders,raskulls,iron-yard,party-mix}` — bundled games,
  each a small Vite app with a `game.manifest.ts`. Party-mix is parked/disabled.

Package names are all `@pfp/<dir>` (e.g. `@pfp/shell`, `@pfp/sdk`). Cross-package
deps use `workspace:*`.

## Architecture — the big picture

The shell and each game live in **separate iframes** and communicate *only*
through the SDK's `postMessage` contract (channel `"pfp"`). This buys isolation
(a buggy game can't crash the shell), engine independence (Godot exports look
like native games), and a clean plug-in story. First-party games may *also*
import shared packages directly — the "hybrid" coupling model.

**The contract (`@pfp/sdk`) is the heart of the system.** Read
`docs/ARCHITECTURE.md` §5 and `packages/sdk/src/{protocol,types,client,host}.ts`
before changing anything protocol-shaped. Key pieces:

- **Lifecycle handshake:** game loads → `ready` → shell sends `launch`
  (with `LaunchContext`: session id, player slots, gamepad indices) → game runs →
  `gameOver` (with a `GameResult`). Other messages: `pause`/`resume`/`terminate`
  (shell→game), `requestExit`/`error` (game→shell), and optional `inputFrame`.
- **The normalizing insight:** every match reduces to a **ranking plus optional
  freeform stats**. `GameResult.standings[]` carries `rank` (1 = winner, ties
  share a rank) and open `stats`/`gameStats` maps the platform stores verbatim
  and never validates. This lets the shell compute generic leaderboards for any
  game with zero knowledge of its rules, and lets achievements be added and
  **back-filled over history** later — so never discard match data.
- **Match records are the source of truth** (`@pfp/data`). All aggregate stats
  are *derived* by querying immutable records, never stored as the primary copy.
  Storage is IndexedDB now, behind a `DataStore` interface so it can swap to
  Tauri/SQLite/cloud later without touching callers.

**Input has two modes.** Each game declares `input.mode` in its manifest:
- `direct` (current default for all games) — game reads `navigator.getGamepads()`
  itself using the `gamepadIndex` from each player slot.
- `forwarded` / `hybrid` — shell sends normalized `ControlFrame`s via
  `@pfp/controls`; the game subscribes instead of polling. The shell only starts
  a forwarder for these modes. See `docs/CONTROLS.md`.

## Adding a game

A game is any web page that runs in an iframe and speaks the contract. Steps
(full guide in `docs/ADDING_A_GAME.md`):

1. Create `games/your-game/` with `index.html`, optional `game.ts`/`vite.config.ts`.
2. Add `games/your-game/game.manifest.ts` using `satisfies GameManifest`.
3. **Wire the manifest into `apps/shell/src/games.ts`** — the catalog imports are
   still explicit. (Catalog generation is planned but not done; until then this
   manual edit is required, and it's the easiest step to forget.)
4. Game calls `client.ready()`, handles `launch`/`pause`/`resume`/`terminate`,
   and ends with `client.gameOver(result)` giving every player a `rank`.
   `result.gameId` must match the manifest `id`; `result.sessionId` must match
   the `LaunchContext.sessionId`.

Dev ports are per-game (declared in each game's `package.json` and manifest
`build.devPort`, e.g. pong 5175, space-invaders 5176).

## Conventions & non-goals

- **Controller-native:** the whole shell UI is drivable with an Xbox controller
  (D-pad/stick to move focus, A = select, B = back). React is for the *menu UI
  only* — games render however they want.
- **Local-first.** No accounts, no internet, no netcode. Online/cloud sync,
  matchmaking, and a storefront are explicit non-goals for now; games are bundled.
- Keep the SDK **additive-by-default** and semver it; breaking changes are major
  with a compatibility shim where feasible.

## Key docs

- `docs/ARCHITECTURE.md` — full platform architecture, contract, milestones (read first).
- `docs/ADDING_A_GAME.md` — complete game-integration guide.
- `docs/CONTROLS.md` — `@pfp/controls` shell-forwarded input API.
- `docs/SHELL_ARCHITECTURE_IMPLEMENTATION_PLAN.md` — next shell/runtime plan.
- `TODO.md` — current task list.
