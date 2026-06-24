# Game Spec Template

Use this before creating a new game, especially for AI-generated games. Keep the
answers concrete enough that implementation and review can test them.

## Game Identity

- **Game id:** `kebab-case-id`
- **Game name:** Human-readable name
- **One-line concept:** One sentence describing the core play.
- **Target integration path:** SDK-only, shell-forwarded controls, or game-kit.
- **Engine/runtime:** Plain canvas, Phaser, Three.js, Godot export, or other.

## Player Count

- **Minimum players:**
- **Maximum players:**
- **Solo behavior:** Real solo mode, bots, practice mode, or unsupported.
- **Team behavior:** Free-for-all, co-op, teams, or not applicable.

## Camera And View

- **View type:** Fixed screen, scrolling camera, split-screen, arena view, board
  view, or other.
- **Logical resolution:** e.g. `1280 x 720`.
- **Important visibility rules:** What must always remain visible.

## Controls

List shell actions, direct-input controls, or both.

| Action  | Input binding          | Held or edge | Notes       |
| ------- | ---------------------- | ------------ | ----------- |
| moveX   | left stick X / d-pad X | held         | Example     |
| moveY   | left stick Y / d-pad Y | held         | Example     |
| primary | A                      | edge         | Example     |
| start   | Start                  | edge         | Pause/start |
| back    | B                      | edge         | Back/cancel |

## Core Loop

Describe one normal round from start to finish.

1. Countdown or ready state:
2. Main play:
3. Scoring/progress:
4. End condition:
5. Results:

## Win And Loss Conditions

- **Win condition:**
- **Loss condition:**
- **Timeout behavior:**
- **Tie behavior:**
- **Ranking rules:**

## Scoring

- **Primary score:**
- **Tie-breakers:**
- **Per-player stats to report:**
- **Match-level stats to report:**

## Entities

List every meaningful gameplay object.

| Entity | Purpose | Movement | Collision | Spawn/despawn |
| ------ | ------- | -------- | --------- | ------------- |
| Player |         |          |           |               |

## Collision Rules

- **Player vs world:**
- **Player vs player:**
- **Player vs hazard/projectile/pickup:**
- **Projectile or item behavior:**
- **Out-of-bounds behavior:**

## Levels Or Content

- **Initial level/map:**
- **Procedural rules, if any:**
- **Required hazards/pickups/objectives:**
- **Content intentionally deferred:**

## Audio And Visual Style

- **Visual direction:**
- **Palette/accent colors:**
- **Required generated or bitmap assets:**
- **Sound effects:**
- **Music/ambience:**
- **Accessibility/readability constraints:**

## Shell Integration

- **Manifest category/tags:**
- **Input mode:** `direct`, `forwarded`, or `hybrid`.
- **Settings fields:**
- **Pause/resume behavior:**
- **Terminate cleanup:**
- **GameResult fields:**

## Test Cases

Write these before or alongside implementation.

- [ ] Creates initial state for minimum and maximum player counts.
- [ ] Maps controls into player actions.
- [ ] Advances core gameplay deterministically.
- [ ] Applies scoring and ranking rules.
- [ ] Produces a valid `GameResult`.
- [ ] Handles pause/resume without a large time jump.
- [ ] Cleans up listeners/timers on terminate.

## Out Of Scope

List features that should not be built in the first pass.

- TBD

## Manual Smoke Checklist

- [ ] Runs standalone dev server.
- [ ] Launches from shell.
- [ ] Keyboard fallback works if supported.
- [ ] Controller pairing works for target player count.
- [ ] Pause, resume, and quit work from shell overlay.
- [ ] Match completes and reaches Results screen.
- [ ] `pnpm test`, `pnpm typecheck`, and package build are green.
