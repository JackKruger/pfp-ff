# Fowl Play — v1 Design Plan

A 2–4 player party platformer in the *Ultimate Chicken Horse* lineage. Players
take turns placing platforms and traps onto an arena, then race to the goal.
You score by reaching the goal, grabbing coins, surviving when others die, or
having your own trap kill someone else.

- **Package**: `@pfp/fowl-play`
- **Folder**: `games/fowl-play/`
- **Dev port**: `5179`
- **Engine**: web (TypeScript + Canvas2D)
- **Input mode**: `direct` (game polls gamepads)
- **Players**: 2–4
- **Category**: `party`

> See also: `games/fowl-play/ASSETS.md` — running list of textures/sprites we
> still need, with style & size details.

---

## 1. Scope & MVP cut

- **One mode** — Party (place → race → score, looped).
- **2–4 players**, no solo mode in v1.
- **No** unlocks, shop, level editor, online play, tutorial mode, cosmetics.
- All pieces and all 3 arenas available from start.
- Placeholder SFX, no music in v1.
- **Visual style**: programmer-art primitives. Rects for platforms, circles for
  characters, distinct silhouette shapes for hazards. Player colors red/blue/
  green/yellow (Xbox-controller inspired). We commit to a real art pass later.

## 2. Tech stack

- **Renderer**: Canvas2D, wrapped behind a tiny `Renderer` interface so we can
  swap to Pixi if perf demands.
- **Physics**: custom AABB, fixed timestep at 1/60s, swept collisions, max 4
  substeps per visual frame.
- **Input**: SDK `direct` mode. Game polls `navigator.getGamepads()` using slot
  indices from `LaunchContext`.
- **State**: plain TS classes + a top-level state machine; no external state lib.
- **No determinism guarantees** (defers replays/spectator-mode).

## 3. Character & movement (committed numbers)

| Field | Value |
|---|---|
| Hitbox | 24×24 AABB |
| Visual | 28-px circle in player color |
| Gravity | 1800 px/s² |
| Max fall | 900 px/s |
| Walk max | 280 px/s |
| Ground accel | 1600 px/s² |
| Ground friction | 1400 px/s² |
| Air accel | 1120 px/s² (70% of ground) |
| Jump launch | 720 px/s |
| Variable cut | release within 180ms caps upward vy to 280 |
| Coyote time | 100ms |
| Jump buffer | 100ms |
| Wall slide gravity | 50% normal |
| Wall slide max | 240 px/s |
| Wall jump | 600 horizontal (away) + 700 vertical |

No double jump, no dash. Keeps the skill ceiling friendly for couch friends.

## 4. Death & respawn

- Instant death on hazard contact, crush, or fall below arena kill-line.
- **Out for the round** (UCH-style). Death drops a colored skull glyph at the
  death position.
- Round ends when all alive players reach goal, OR all are dead, OR the 60s
  race timer expires.

## 5. Round structure

| Phase | Length | Notes |
|---|---|---|
| Placement | 30s | auto-commit at zero or when all ready |
| Race | 60s hard cap | 3s countdown at start |
| Score | 5s | shows round delta + cumulative |

Match length: **first to 9 points**, evaluated at end of each score phase
(so all rounds finish naturally). Tiebreak order: most coins → most finishes
→ sudden-death race (no placement).

## 6. Piece library (16 player-placeable)

### Platforms (5)
| # | Name | Size | Behaviour |
|---|---|---|---|
| 1 | Wooden Plank | 96×16 | static |
| 2 | Small Block | 32×32 | static |
| 3 | Ice Block | 64×32 | low friction (200) |
| 4 | Bouncy Platform | 64×16 | +400 vy on top-contact |
| 5 | Conveyor | 96×16 | pushes 200 px/s in rotation-chosen direction |

### Hazards (6)
| # | Name | Size | Behaviour |
|---|---|---|---|
| 6 | Spike Strip | 64×16 | lethal from above |
| 7 | Saw Blade | 32 dia | spinning, lethal any side |
| 8 | Crusher | 48×48 | drops every 2s, lethal under |
| 9 | Hot Coals | 48×16 | lethal contact |
| 10 | Fan | 48×48 | blows 300 px/s in chosen direction (non-lethal) |
| 11 | Hockey Puck | 32×32 | launches at race start, bounces, lethal |

### Movers (3)
| # | Name | Size | Behaviour |
|---|---|---|---|
| 12 | Swinging Mace | 48×16 on 96px chain | lethal |
| 13 | Pendulum Platform | 96×16 | swings, ride-able |
| 14 | Falling Log | 16×96 | drops 3s into race, lethal |

### Helpers (2)
| # | Name | Size | Behaviour |
|---|---|---|---|
| 15 | Trampoline | 48×16 | +600 vy |
| 16 | Ladder | 16×96 | climbable |

Scorers (coin, diamond) are **arena-placed**, not in the player hand.

## 7. Placement mechanic

- Each player gets a **random hand of 5 pieces** per round.
- Each player places **exactly 1 piece** per round; unused hand is discarded.
- 16×16 grid snap; 4 cardinal rotations (RB CW, LB CCW).
- No overlap with arena solids or other placements.
- 64-px-radius no-go zones around start and goal.
- All commits resolved at timer end; spatial conflicts resolved by
  last-confirm-wins.
- Ghost preview in player color while cursoring.

## 8. Scoring

| Source | Points |
|---|---|
| Reach goal | +1 |
| Coin grab | +1 each |
| Diamond grab | +3 (one per arena) |
| Lone survivor finish | +2 bonus |
| Your trap killed a player | +1 per kill |

Recorded but not scored: trap-self-kill (your own piece killed you — fun stat).

## 9. Camera & view

- Single shared dynamic camera.
- Race phase: tracks AABB of alive players + start + goal, 96-px padding, zoom
  clamp [0.5, 1.0], lerp 10%/frame.
- Placement phase: zoomed to full arena bounds, static.
- Off-screen below kill-line = death. No wrap, no constrain.

## 10. Arenas (3 at launch)

### The Barnyard
Wide, short. Mostly horizontal. Gaps over hay bales. 2 coins mid-air requiring
jumps. Start left, goal right.

### The Silo
Tall, narrow. Climb from bottom to top. Pre-built ledges + 1 ladder. 2 coins
and 1 diamond on tricky ledge.

### The Windmill
Medium, mixed verticality. Rotating environmental blade that pushes/kills if
hit. 1 coin near blade for risk/reward. Goal up-and-to-the-right.

Each arena defines: start zone, goal zone, kill-line, pre-existing solids,
scorer positions, no-go zones.

## 11. Controls

### Placement phase
| Input | Action |
|---|---|
| L-stick / D-pad | move cursor |
| A | confirm placement |
| B | cancel last own placement |
| X | next piece in hand |
| Y | previous piece in hand |
| RB | rotate piece 90° CW |
| LB | rotate piece 90° CCW |
| Start | ready up early |
| Select/Back | leave (with confirm) |

### Race phase
| Input | Action |
|---|---|
| L-stick / D-pad | move |
| A | jump (variable height) |
| B | reserved |
| (pressing into wall) | wall slide |
| A while sliding | wall jump |

## 12. SDK integration

### Manifest
```ts
{
  id: 'fowl-play',
  version: '0.1.0',
  name: 'Fowl Play',
  players: { min: 2, max: 4 },
  input: { mode: 'direct' },
  build: { devPort: 5179 },
  presentation: { category: 'party', ... }
}
```

### `GameResult.standings`
One entry per slot, sorted by `finalScore` desc. `rank` 1 = winner, ties share
rank.

### Per-player `gameStats`
Record-everything-cheap policy:
- `finalScore`
- `roundsWon`
- `finishes`
- `deaths`
- `coinsCollected`
- `diamondsCollected`
- `killsCaused`
- `loneSurvivor`
- `trapsPlaced`
- `selfKills`
- `piecesByType: Record<pieceId, number>`

### Match-level `stats`
- `arenaIds: string[]`
- `roundsPlayed`
- `matchDurationMs`
- `winningScore`

### Pause/resume contract
- `pause`: freeze physics, dim screen, show "Paused".
- `resume`: 1s countdown then continue.
- `terminate`: clean shutdown, no `gameOver`.

## 13. Code layout

```
games/fowl-play/
├── game.manifest.ts
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
├── ASSETS.md             # running texture/sprite list
└── src/
    ├── main.ts           # SDK client + bootstrap
    ├── game.ts           # top-level FSM
    ├── types.ts
    ├── phases/{placement,race,score}.ts
    ├── physics/{aabb,player,world}.ts
    ├── pieces/{registry,platform,hazard,mover,helper}.ts
    ├── arenas/{barnyard,silo,windmill}.ts
    ├── render/{canvas,camera,hud}.ts
    └── input/gamepad.ts
└── test/{physics,pieces,scoring,placement,winCondition}.test.ts
```

Top-level FSM: `boot → lobby (await launch) → intro → [placement → race →
score] loop → final → gameOver-emitted`.

## 14. Testing plan

### Unit tests (Vitest, headless node env)
- Physics: AABB sweep, jump-height invariants (max height ≈ v₀²/2g), wall-jump
  exit vector, friction decay.
- Pieces: each piece's collision/contact behaviour in isolation.
- Placement validation: grid snap, overlap, no-go zone, rotation transforms.
- Scoring: per-round point calc across 8+ scripted scenarios (all-die,
  lone-survivor, kill-credit, ties).
- Win condition + tiebreak resolution.
- Camera AABB→zoom math.

### Integration tests
- Headless full-match runner that feeds scripted inputs and asserts final
  `GameResult` shape + stats.

### Manual playtests
- Solo dev with 2 controllers (week 1) — sanity check feel.
- 2P couch (week 2) — fun curve, control clarity.
- 4P couch (week 3) — dead pieces, dominant strategies, confusion, session
  length sweet spot.

### Perf targets
60fps with 4 players + 30 placed pieces + 3 active movers. Physics step
< 4ms.

## 15. Edge cases (resolved)

- **All die before goal**: round ends immediately at last death; finish points
  = 0; kill credit still pays.
- **One reaches, others alive**: race continues until all reach or 60s timer.
- **Goal made unreachable by placements**: tolerated; round times out;
  players learn.
- **Controller unplug mid-round**: that slot "ghosted" for remainder of round;
  returns at next placement.
- **AFK during placement**: slot skips placement that round.
- **Joining mid-match**: not allowed.

## 16. Onboarding & accessibility

- First placement of every match prepends a 5s "look around" pre-timer with
  corner control-hint overlay.
- Piece tooltip (name + one-line) on hover.
- Player colors paired with distinct shape outlines for protanopia/deuteranopia
  readability.
- Every audio cue has a visual counterpart.

## 17. Defaults locked (revisit post-MVP)

Match length 9 · simultaneous placement · wall-jump enabled · 4 distinct
player colors · HUD = top-screen player chips with score + cumulative coin
count · 60fps target.

## 18. Deferred (not v1)

Solo/CPU · additional arenas/themes · expanded piece library · online play ·
level editor · SFX/music polish · full tutorial · difficulty options ·
controller hot-plug recovery · mid-match join · replay/spectator.
