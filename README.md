# PFP-FF

A couch-multiplayer game platform: a console-like shell where 1–4 friends grab
Xbox controllers and play a library of simple, fun couch games on one screen.
Profiles and long-term stats persist across sessions. New games — native
TypeScript or Godot (HTML5 export) — plug into a single, versioned contract.

**Status:** Active prototype. The shell, profiles, pairing, stats, manifest-backed
game catalog, SDK lifecycle, and shell-forwarded controls infrastructure are
implemented. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the platform architecture and
[`docs/SHELL_ARCHITECTURE_IMPLEMENTATION_PLAN.md`](docs/SHELL_ARCHITECTURE_IMPLEMENTATION_PLAN.md)
for the next shell/runtime plan.

## At a glance

- **Shell + plugin contract**, not a monolith — adding a game is cheap.
- **One contract, multiple engines** — native-TS and Godot games share the same socket.
- **Local-first** — runs on one machine, no accounts/internet required.
- **Controller-native UI** — drive everything with an Xbox controller.
- **Portable** — browser now, Tauri/Electron kiosk later.

## Current game library

- **Playable:** Raskulls, Pong, Space Invaders, Iron Yard.
- **Parked / disabled:** Party Mix, Stick Fight placeholder.

## Current milestone

Harden the shell as a reusable local game platform: reliable pause/resume,
green typecheck/build gates, better profile recency, manifest-driven game
metadata, shell-forwarded controls, and a small starter game kit for future
generated games.

## Implemented platform pieces

- **`@pfp/sdk`** — iframe lifecycle, launch context, results, errors, pause/resume,
  terminate, and optional `inputFrame` messages.
- **`@pfp/input`** — browser Gamepad API normalization, polling, pairing, and
  edge detection.
- **`@pfp/controls`** — optional shell-forwarded control frames for games that
  do not want to poll devices directly. See [`docs/CONTROLS.md`](docs/CONTROLS.md).
- **`@pfp/data`** — local profile and match persistence with derived stats.
- **Per-game manifests** — `games/*/game.manifest.ts` files provide catalog,
  presentation, input mode, and build metadata.

## Still planned

- **`@pfp/game-kit`** — small 2D canvas runtime for fast first-party and
  AI-generated games.
- Manifest catalog generation so adding a real game no longer requires editing
  `apps/shell/src/games.ts`.
