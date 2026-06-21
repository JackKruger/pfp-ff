# PFP-FF

A couch-multiplayer game platform: a console-like shell where 1–4 friends grab
Xbox controllers and play a library of simple, fun couch games on one screen.
Profiles and long-term stats persist across sessions. New games — native
TypeScript or Godot (HTML5 export) — plug into a single, versioned contract.

**Status:** Planning. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the
full architecture and milestone plan.

## At a glance

- **Shell + plugin contract**, not a monolith — adding a game is cheap.
- **One contract, multiple engines** — native-TS and Godot games share the same socket.
- **Local-first** — runs on one machine, no accounts/internet required.
- **Controller-native UI** — drive everything with an Xbox controller.
- **Portable** — browser now, Tauri/Electron kiosk later.

## First milestone

A full vertical slice: `menu → pair controllers → play Pong → record result → see stats`.
