# Iron Yard — Handoﬀ

A physics-driven medieval melee brawler ported from a client-server
architecture to run inside the PFP-FF couch-multiplayer shell.

**Source:** <https://github.com/KreatureofKreation/iron-yard> (commit May 2026)
**Port date:** 2026-06-21
**Location in this repo:** `games/iron-yard/`

---

## 1. What this port does

The original Iron Yard is a **client-server** game — an authoritative Node.js
server runs physics, combat, and bot AI, while a Three.js client renders and
sends inputs over WebSocket. This port **collapses both layers into a single
client-side app** that runs entirely in the browser, loaded as an iframe by the
PFP-FF shell.

### What was collapsed

| Layer | Original | Port |
|-------|----------|------|
| Networking | WebSocket (ws), 30 Hz tick, 20 Hz snapshots | Direct function calls in local game loop |
| Game loop | Server `setInterval` | Browser `setInterval` (sim) + `requestAnimationFrame` (render) |
| Input | Client sends `{t:"input", ...}` each tick | `InputManager` polls Gamepad API + keyboard each tick |
| Physics | Rapier3D on Node.js | Same Rapier3D (WASM) in browser |
| State broadcast | Server serializes snapshots → JSON → WS | Game state is read directly by the render loop (same JS context) |
| Bot AI | Runs on server | Runs in same JS context as everything else |
| Menus | Built into `client/index.html` with CSS overlays | Handled by PFP-FF shell; game launches directly into match |

### What was translated 1:1

- **config.ts** — all tunables (weapons, physics, combat, match rules) verbatim
- **math.ts** — the vec3 math library and segment-vs-capsule intersection
- **arena.ts** — spawn points, weapon rack positions, arena wall clamping
- **player.ts** — player state, `applyInput`, movement/stamina/jump physics
- **physics.ts** — Rapier3D wrapper (sword bodies, capsule bodies, torso/head
  ragdolls, collision detection)
- **combat.ts** — full damage formula, hit zones, block/parry/stun/bleed/sever
- **bot.ts** — bot AI (target selection, strafe, dodge, feint, 4 attack types)

---

## 2. File map

```
games/iron-yard/
├── index.html              # entry point loaded by the shell's iframe
├── package.json            # workspace package (@pfp/iron-yard)
├── vite.config.ts          # Vite dev server on port 5177
├── tsconfig.json           # TypeScript config (compiles to ESNext)
└── src/
    ├── main.ts             # Game engine, render loop, SDK wiring (the "Room")
    ├── config.ts           # All tunables in one place
    ├── math.ts             # Vec3 + segment geometry
    ├── arena.ts            # Spawn points, weapon racks, wall clamping
    ├── player.ts           # Player state machine + input application
    ├── bot.ts              # Bot AI (targeting, dodging, attack phases)
    ├── combat.ts           # Hit resolution (damage, zones, status effects)
    ├── physics.ts          # Rapier3D wrapper (sword+bodies+ragdolls)
    ├── scene.ts            # Three.js arena (walls, ground, torches, racks)
    ├── character.ts        # Full armored knight rig + animations
    ├── input.ts            # Gamepad + keyboard input adapter
    └── audio.ts            # Procedural Web Audio (no asset files)
```

### Key dependency: Rapier3D

The game requires **`@dimforge/rapier3d-compat`** — a Rust physics engine
compiled to WASM. It's loaded asynchronously in `main.ts` on first launch:

```ts
// main.ts, bottom
client.onLaunch(async (context) => {
  await initRapier();  // ~1s cold-start WASM init
  game = new Game();
  game.start(context);
  game.running = true;
});
```

The WASM binary is ~800 KB and is bundled by Vite into the production build.
Expect a ~2.5 MB total bundle (mostly Three.js + Rapier).

---

## 3. How to run

### Dev

```bash
pnpm install          # first time: installs rapier3d-compat, three, etc.
pnpm dev              # starts shell + all games including iron-yard on :5177
```

Open `http://localhost:5173` — Iron Yard appears in the game grid. Select
players, launch.

### Dev (standalone)

```bash
cd games/iron-yard
pnpm dev              # just this game on :5177
# open http://localhost:5177/games/iron-yard/
```

When running standalone, the SDK's `createGameClient()` will not find a parent
shell — the game won't auto-launch. Use the PFP-FF shell for full integration
testing.

### Build

```bash
pnpm build            # builds everything including iron-yard
# or
cd games/iron-yard && npx vite build
```

### Type-check

```bash
npx tsc --noEmit -p games/iron-yard/tsconfig.json
```

---

## 4. Architecture — how the game loop works

### Tick structure (`Game.step()`, 30 Hz)

```
each tick:
  ┌─ 1) Resolve inputs ─────────────────────────────────────────┐
  │    for each player:                                          │
  │      bot?    → botInput() generates input                     │
  │      human?  → InputManager.getInput() polls keyboard/gamepad│
  │      frozen? → zeroed input                                  │
  │    → applyInput(p, input, dtMs)  // updates p.pos, stamina, etc.
  │    → p.weaponTipTarget = p.weaponTip  // stamp aim target    │
  └──────────────────────────────────────────────────────────────┘
  ┌─ 2) Drive physics ──────────────────────────────────────────┐
  │    for each player:                                          │
  │      sync body capsule to p.pos (kinematic)                  │
  │      if stunned/dead/disarmed → sword gravity ON (drop)     │
  │      else → driveSword() via spring toward weaponTipTarget   │
  │      driveTorso(), driveHead() (restorative torque)          │
  │    → physics.step()  // Rapier solves all bodies             │
  └──────────────────────────────────────────────────────────────┘
  ┌─ 3) Read back physics ──────────────────────────────────────┐
  │    for each player:                                          │
  │      p.weaponTip = swordState().pos                          │
  │      compute tip velocity (physics vel − player vel)         │
  │      detect commit-strike (direction reversal at speed)      │
  └──────────────────────────────────────────────────────────────┘
  ┌─ 4) Bleed ticks ────────────────────────────────────────────┐
  └─ 5) Respawn dead players ───────────────────────────────────┘
  ┌─ 6) Weapon rack pickups ────────────────────────────────────┐
  └─ 7) Body slam collisions ───────────────────────────────────┘
  ┌─ 8) Combat + match phase ───────────────────────────────────┐
  │    if countdown → check timer → transition to playing        │
  │    if playing:                                               │
  │      drain wall clashes → audio                              │
  │      resolveHits() → Rapier collision contacts → damage      │
  │      check score-to-win → endRound() if champion             │
  │      check round timeout → endRound() with highest score     │
  │    if intermission → check timer → reset + new countdown     │
  └──────────────────────────────────────────────────────────────┘
```

### Render loop (`Game.renderLoop()`, requestAnimationFrame)

```
each frame:
  ┌─ Track camera to human players' average position ───────────┐
  └─ Update character rigs ─────────────────────────────────────┘
  │    for each player:                                          │
  │      set rig.root position/rotation from p.pos, p.yaw       │
  │      rig.weaponRig.lookAt(tipWorld)                          │
  │      rig.pushTrail()  // sword trail buffer                  │
  │      rig.animate()    // walk cycle, lean, death pose        │
  │      rig.setInvuln()  // spawn invulnerability pulse         │
  └──────────────────────────────────────────────────────────────┘
  ┌─ Torch flicker animation ───────────────────────────────────┐
  └─ Update HUD overlay (HP bars, countdown, scores) ───────────┘
  └─ renderer.render(scene, camera) ────────────────────────────┘
```

### PFP-FF SDK integration

```ts
// main.ts bottom — the whole lifecycle
const client = createGameClient();

client.onLaunch(async (context: LaunchContext) => {
  await initRapier();
  game = new Game();
  game.start(context);   // creates players, bots, starts sim+render loops
});

client.ready();  // tells shell: "I'm loaded, send me launch"
```

When the match ends (score-to-win reached), `endMatch()` is called:

```ts
endMatch() {
  this.stop();  // clears sim interval + cancel animation frame
  client.gameOver({
    gameId: "iron-yard",
    sessionId: this.context.sessionId,
    standings: [...],  // ranked by score
    // ...
  });
}
```

The shell then navigates to the Results screen.

---

## 5. Known issues and missing features

All 23 issues from the original handoff have been resolved. See CHANGELOG below for details.

### ✅ Completed fixes (2026-06-21)

| # | Issue | Status | Resolution |
|---|-------|--------|------------|
| 1 | Weapon tip fixed forward | **DONE** | Added `aimDX`/`aimDY` to `PlayerInput`. `InputManager` reads right-stick/keyboard aim. `main.ts` computes weapon tip from aim offset, clamped to max reach. |
| 2 | Attack animation system | **DONE** | Added attack state machine to `Player` (attackPhase, attackType, attackStartMs). Phases: idle→windup→release→recovery. `attackT`/`attackType` passed to `rig.animate()`. |
| 3 | Enemy dropped-sword pickup | **DONE** | Added loop in `main.ts` step() that checks nearby dead players and picks up their weapon key. |
| 4 | Screen shake | **DONE** | `shakeAmount` field, triggered by hit damage, applied as random offset to camera position with 0.85 decay per frame. |
| 5 | Hit flash | **DONE** | White overlay `div` (hitFlashEl). Opacity set proportional to damage, fades out each frame via `opacity *= 0.8`. |
| 6 | Directional hit-from indicator | **DONE** | Arrow (`⬇`) in HUD pointing toward last attacker, rotated via CSS transform. Fades after 800ms. |
| 7 | Spark/particle effects | **DONE** | `spawnSparks()` creates small sphere meshes with velocity, gravity, opacity fade, scale shrink. Colored by hit zone. Fired on hits, kills, clashes. |
| 8 | 3D nameplates | **DONE** | `worldToScreen()` projects 3D position to 2D. CSS elements show HP bar, stamina bar, name, K/D above each player's head. |
| 9 | Kill feed | **DONE** | Scrolling death notifications in top-right corner, auto-removed after 4s. Shows killer name, weapon, victim. |
| 10 | Prop/barrel rendering | **DONE** | `updateProps()` creates cylinder meshes for 6 arena barrels, syncs position/rotation from physics each frame. |
| 11 | Helm fly-off | **DONE** | On lethal headshot (helmBreak + kill), helm mesh is detached from rig, added to scene, removed after 5s. |
| 12 | Match events emitted | **DONE** | `matchStart`, `matchEnd`, `slam`, `wallClash`, `pickup` events pushed to `pendingHits`. |
| 13 | Weapon-specific rest poses | **DONE** | Added `WEAPON_REST_POSES` config with per-weapon rest positions. |
| 14 | Idle breathing/sway | **DONE** | Sinusoidal sway added to weapon tip target in step() when attack phase is idle. |
| 15 | Attack body animation | **DONE** | Crouch, surge, spine bend, torso twist, pelvis counter-rotation in character.ts animate() based on attackT progress. |
| 16 | Shield-blocking arm pose | **DONE** | `grip==="shield"` sets left arm to guard pose, raises higher when blocking. Shield mesh created on demand. |
| 17 | Two-hand grip body twist | **DONE** | Left arm reaches across chest to grip point using world-space IK. |
| 18 | Swordshield weapon | **DONE** | Added to `config.ts` with grip:"shield", shieldBonus:true. Combat block check applies +0.20 reduction. |
| 19 | Invuln pulse on all meshes | **DONE** | `setInvuln()` now pulses all 22 meshes (torso, limbs, helm parts, pauldrons, etc.). |
| 20 | Weapon tip one-tick lag | **DONE** | Already functional (pre-move → post-move body drive). |
| 21 | Bot difficulty configurable | **DONE** | Read from `LaunchContext.settings.botDifficulty`. |
| 22 | Bot chat display | **DONE** | `kind:"chat"` events pushed to kill feed. |
| 23 | Score-to-win configurable | **DONE** | Read from `LaunchContext.settings.scoreToWin`. |

---

## 6. Suggested work priorities

### Phase A — Make it look alive (2-4 hours)

1. **Port the attack animation system** from `main.js`. The core data is already
   there: `PHASE_BASE` timings, weapon-local chamber/contact/end poses. Tie it
   into a per-player button press detector (right trigger or B button starts an
   attack). Feed `attackT` and `attackType` into `rig.animate()`.

2. **Port the rest pose system.** Replace the hardcoded `weaponTip = forward *
   0.8` with weapon-specific local coordinates from `REST_BY_KEY`, then add
   `restLocal()` breathing/sway.

3. **Enable mouse/stick aiming** for the weapon tip. In the original, right
   stick / mouse position drives the weapon tip in world space (clamped to
   reach). Add gamepad right-stick → tip offset to `input.ts`, then apply in
   `main.ts` step 1.

### Phase B — Visceral feedback (3-5 hours)

4. **Screen shake** — add a shake offset to `camera.position` in the render
   loop, triggered by hit events.

5. **Spark particles** — the original uses a `spark()` function that spawns
   small THREE.Mesh objects with upward velocity and short lifetime. Port it
   (it's ~15 lines of code). Wire it to hit/clash/wall/slam events.

6. **Hit flash** — overlay a briefly fading white div on hit.

7. **3D nameplates** — use CSS-positioned divs or THREE.Sprite labels to show
   player names and HP bars in world space. The original uses a `#nameplates`
   container with absolutely-positioned child divs.

8. **Kill feed** — use the existing `#hud` div to show scrolling kill messages.

### Phase C — Depth and polish (2-4 hours)

9. **Enemy sword pickup** — add the missing loop from `room.js` lines 210-230
   into `main.ts` step.

10. **Helm fly-off** — when `helmBreak && kill`, detach the helm mesh from the
    rig, spawn it as a physics ball with gravity, remove after a few seconds.

11. **Prop/barrel rendering** — create cylinder meshes for the 6 arena prop
    positions, update their transforms each frame from `physics.propsState()`.

12. **Swordshield weapon** — add to config, build shield mesh in character,
    handle `grip=="shield"` in combat block logic.

13. **MVP display** — track `p.roundDamage`, show highest-damage player on
    intermission screen.

### Phase D — Config and polish (1-2 hours)

14. **Bot difficulty selector** — either via URL params or a pre-game setting
    passed through `LaunchContext.settings`.

15. **Score-to-win configurable** — accept from shell settings.

16. **Match events into HUD** — populate `pendingHits` with matchEnd,
    matchStart, pickup, and slam events for HUD display.

---

## 7. Design decisions

### Why Rapier WASM instead of simplified physics?

The original's combat feel comes from Rapier's spring-driven sword bodies —
heavier weapons accelerate slower and overshoot the target; tip velocity (and
thus damage) is computed from actual rigid-body dynamics, not gameplay
animation. Replacing this with a simpler system would change the entire feel of
the game. The WASM cost (~800 KB) is acceptable for a single game in the
library.

### Why overhead camera instead of per-player?

PFP-FF is a couch multiplayer platform — everyone shares one screen. The camera
follows the average position of human players. Split-screen could be added
later (N viewports rendered in the same canvas) but is a per-game
implementation detail, not a platform requirement.

### Why keyboard fallback?

Most PFP-FF games are controller-only, but during development/testing on a
laptop without controllers, keyboard input lets you verify the game works.
Bound to WASD + Arrow keys per player.

### Why no menu?

PFP-FF handles player selection, profile assignment, and game launching via its
shell. The game receives `LaunchContext` with player names, colors, and
controller assignments — no in-game menu needed. Weapon selection could be
added via shell settings in `LaunchContext.settings`.

### Why TypeScript?

The original is plain JavaScript. PFP-FF is a TypeScript monorepo with shared
types via `@pfp/sdk`. The port uses strict TypeScript throughout to:
- Share type definitions across modules (Player, WeaponConfig, etc.)
- Catch null/undefined errors at compile time (many existed in the JS original)
- Enable autocomplete and refactoring in the IDE

---

## 8. Build and dependency notes

### `package.json`

```json
{
  "name": "@pfp/iron-yard",
  "private": true,
  "type": "module",
  "dependencies": {
    "@dimforge/rapier3d-compat": "^0.12.0",
    "@pfp/sdk": "workspace:*",
    "three": "^0.169.0"
  },
  "devDependencies": {
    "@types/three": "^0.169.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.11"
  }
}
```

### `vite.config.ts`

- `server.port: 5177` with `strictPort: true` — must match the dev entry in
  `apps/shell/src/games.ts`
- `optimizeDeps.exclude: ["@dimforge/rapier3d-compat"]` — prevents Vite from
  trying to pre-bundle the WASM module
- `build.target: "esnext"` — WASM requires modern browser features

### Shell registration (`apps/shell/src/games.ts`)

```ts
{
  id: "iron-yard",
  name: "Iron Yard",
  version: "0.1.0",
  engine: "web",
  entry: ironYardEntry,  // dev: http://localhost:5177/ — prod: /games/iron-yard/index.html
  players: { min: 1, max: 4 },
  sdk: "^1.0.0",
  tags: ["fighting", "medieval", "physics"],
}
```

---

## 9. Testing

### Unit tests

There are no unit tests yet. The most testable modules are `math.ts`,
`player.ts`, and `combat.ts` — they're pure functions without DOM or rendering
dependencies.

Suggested test file: `games/iron-yard/test/`
- `math.test.ts` — segment-vs-capsule intersection edge cases
- `player.test.ts` — input application, stamina drain, gravity
- `combat.test.ts` — damage formula boundaries, hit zone calculation

### Manual testing

To test standalone (without the shell), open the Vite dev server directly. The
game will render the arena and initialize Three.js, but won't start the match
loop (it's waiting for a `launch` message from the shell). To force-start for
testing, add this to the bottom of `main.ts` temporarily:

```ts
// Quick-standalone test — remove before committing
setTimeout(async () => {
  await initRapier();
  game = new Game();
  const fakeCtx = {
    sessionId: "test",
    sdkVersion: "1.0.0",
    players: [
      { slot: 0, profileId: null, displayName: "Test", color: "#ff0000", gamepadIndex: -1 },
    ],
    settings: {},
  };
  game.start(fakeCtx);
  game.running = true;
}, 1000);
```

---

## 10. Key files in the original repo (for reference)

| Original file | Lines | Role |
|---------------|-------|------|
| `server/src/config.js` | 130 | All tunables |
| `server/src/math.js` | 70 | Vec3 + segment geometry |
| `server/src/arena.js` | 55 | Spawns, racks, wall clamping |
| `server/src/player.js` | 220 | Player state, `applyInput` |
| `server/src/bot.js` | 280 | Bot AI |
| `server/src/combat.js` | 200 | Hit resolution |
| `server/src/physics.js` | 470 | Rapier3D wrapper |
| `server/src/room.js` | 510 | Game loop, match state |
| `server/src/index.js` | 220 | WebSocket server + snapshot broadcast |
| `client/src/main.js` | 1700 | **Attack animations, rest poses, sparks, HUD, camera, nameplates, menu** |
| `client/src/character.js` | 620 | Armored knight rig (body anim, attack poses, shield, trails) |
| `client/src/scene.js` | 200 | Three.js arena |
| `client/src/audio.js` | 150 | Procedural audio |
| `client/src/input.js` | 200 | Mouse/WASD/twin-stick input |
| `client/src/network.js` | 100 | WebSocket client |
| `client/src/hud.js` | 180 | Scoreboard, kill feed, chat |
| `client/src/ragdoll.js` | 300 | Active ragdoll client-side |

The **most important file to study** for future work is `client/src/main.js`
(1700 lines). It contains everything visual that's missing from the port:
attack poses, sparks, screen shake, nameplates, hit indicators, and the camera
system.

---

## 11. Gotchas

- **Rapier `timestep` must match tick rate.** `PhysicsWorld` sets
  `world.timestep = 1 / tickHz`. If you change `TICK_HZ`, no other change is
  needed — physics will adapt.

- **Sword tip velocity excludes player velocity.** This is intentional:
  walking/running shouldn't count as "swinging." The tip velocity is computed
  as `(swordPos.delta / dt) - playerVel`. This makes jumping and sprinting
  safe — you can't accidentally kill someone by running into them with your
  sword out.

- **Weapon tip is clamped to max reach for anti-cheat.** The original did this
  for networked clients; the port keeps it for consistency. `maxReach =
  weapon.length + 1.2m` (1.2m = arm length + fudge).

- **`p.weaponTip` serves double duty.** During `applyInput`, it's written as the
  *target* (provided by the client/bot, clamped). After `physics.step()`, it's
  overwritten with the *actual* Rapier-computed sword position. This is how the
  original worked — tip is remapped mid-tick.

- **Bleed uses an accumulator for fractional damage.** `bleedDmgPerSec` can
  produce fractional values (e.g., 0.3 dmg/sec). `bleedAccum` accumulates; when
  it crosses 1.0, a whole point of damage is applied and the accumulator is
  decremented.

- **Spawn anti-camp.** If a player dies within 3 seconds of their last spawn,
  `spawnedAtMs` is set 1.5s into the future, giving 3s total invulnerability.
  This prevents spawn-killing in small arenas.

- **Bot stuck detection.** Bots track position every 250ms. If they move less
  than 0.15m, a stuck counter increments. At stuck≥2 they jitter; at stuck≥6
  they reverse direction. This prevents bots from humping walls.