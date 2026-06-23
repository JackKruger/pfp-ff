# To-Do

## Assets needed

### Must-have

- [x] `apps/shell/public/thumbnails/pong.png` — game card thumbnail (220×160 px, PNG or WebP)
- [x] `apps/shell/public/thumbnails/stick-fight.png` — game card thumbnail (220×160 px)
- [x] `apps/shell/public/thumbnails/party-mix.png` — game card thumbnail (220×160 px)
- [x] `apps/shell/public/favicon.svg` — browser tab icon (32×32), then add `<link rel="icon" href="/favicon.svg">` to `apps/shell/index.html`

### Nice-to-have

- [x] Wordmark / logo SVG for the home screen header — replaces the plain "PFP-FF" `<h1>`
- [x] Gamepad silhouette SVG (16–20 px) for the "No controller" state in `PlayerCard`
- [x] Button-A icon SVG (16–20 px) for the "Press A to join" state in `PlayerCard`
- [x] Subtle background texture (tileable noise, dot-grid, or scanlines at ~2% opacity) for `body`

### Optional

- [x] Custom medal / trophy SVGs to replace the 🥇🥈🥉 emoji in `ResultsScreen` and `StatsScreen`
- [x] Boot splash illustration for the loading screen (replaces the plain CSS spinner)

---

## Games to build

- [x] Pong (Phase 5) — first real native-TS game through the SDK contract

---

## Platform and shell hardening

- [ ] Implement the shell architecture plan.
  - Plan: `docs/SHELL_ARCHITECTURE_IMPLEMENTATION_PLAN.md`
  - Scope: hardening, manifest cleanup, shell-forwarded controls, `@pfp/game-kit`, templates, and AI-generated game workflow.

- [x] Wire the shell pause overlay to the SDK lifecycle.
  - Files: `apps/shell/src/screens/GameScreen.tsx`, `apps/shell/test/`
  - When the shell enters the in-game pause overlay, call `host.pause()`.
  - When the player resumes, call `host.resume()` and reset timing in the game via existing SDK handlers.
  - Add focused coverage so Start/Esc pause and resume cannot regress.

- [x] Restore a green repository typecheck.
  - Files: `games/party-mix/test/tiles.test.ts`
  - Fix the TypeScript narrowing issue around the `state.phase === "moving"` loop.
  - Keep the existing star-tile behavior tests intact.

- [x] Make build confidence match typecheck confidence.
  - Files: `package.json`, game package scripts under `games/*/package.json`, app package scripts under `apps/*/package.json`
  - Ensure CI/release flow runs `pnpm typecheck` before or as part of build.
  - Prefer `tsc && vite build` for workspace packages that ship TypeScript games/apps.

- [x] Update profile recency when matches are recorded.
  - Files: `apps/shell/src/store.ts`, `packages/data/src/types.ts`, `packages/data/test/`, `apps/shell/test/`
  - Use each recorded standing's `profileId` to update `Profile.lastPlayedAt`.
  - Ignore guest/null profiles.
  - Add tests for single-profile and multi-profile matches.

- [x] Refresh project docs to match current state.
  - Files: `README.md`, `TODO.md`, `docs/ARCHITECTURE.md`
  - Replace the old "Status: Planning" language with the current shell/game status.
  - List current playable, disabled, and in-progress games.
  - Capture the next platform architecture direction before adding more games.

- [x] Add typed game manifests and wire the shell catalog to them.
  - Files: `packages/sdk/src/types.ts`, `games/*/game.manifest.ts`, `apps/shell/src/games.ts`, `apps/shell/test/shellRules.test.ts`
  - Add optional manifest metadata for input mode, settings, presentation, and build/dev data.
  - Move real game metadata into per-game manifests while keeping shell placeholders local.
  - Preserve current shell `GameEntry` behavior and verify enabled games have build metadata.

- [x] Add a minimal shell-forwarded controls prototype.
  - Files: `packages/sdk/src/protocol.ts`, `packages/sdk/src/client.ts`, `packages/sdk/src/host.ts`, `packages/controls/`
  - Add SDK `inputFrame` transport support from shell host to game client.
  - Add `@pfp/controls` frame construction, forwarding, and game-side client helpers.
  - Keep existing games on direct input until a later migration slice.

- [x] Wire shell-forwarded controls into the game host lifecycle.
  - Files: `apps/shell/src/screens/GameScreen.tsx`, `apps/shell/src/shellRules.ts`, `apps/shell/test/shellRules.test.ts`
  - Start a control forwarder only for games with `input.mode` set to `forwarded` or `hybrid`.
  - Pause/resume/dispose the forwarder with the SDK game lifecycle.
  - Keep all current manifests on `direct` input so existing games do not change behavior.

---

## Raskulls accuracy roadmap

Goal: move `games/raskulls` from a lightweight Raskulls-inspired prototype toward a closer mechanical and presentation match for the original XBLA game, while staying within our local multiplayer party-shell constraints.

### Phase 1 — Core block system

- [x] Replace the current `dirt`/`crate` block model with color-aware Raskulls blocks.
  - Files: `games/raskulls/src/systems/terrain.ts`, `games/raskulls/src/assets.ts`, `games/raskulls/test/terrain.test.ts`
  - Add tile kinds for colored blocks, gray blocks, steel/indestructible blocks, hazards, pickups, and finish tiles.
  - Store block color/type metadata in structured terrain cells instead of a flat `TileKind` string when needed.
  - Keep a compatibility adapter only if it avoids rewriting every scene in one pass.

- [x] Implement gravity for unsupported blocks after a wand break.
  - Files: `games/raskulls/src/systems/terrain.ts`, `games/raskulls/src/scenes/PlayScene.ts`
  - After destroying a block, scan each affected column and drop floating block groups into empty cells.
  - Animate the drop in `PlayScene` after the terrain state changes, instead of instantly redrawing the whole grid.
  - Add tests for single-block drops, stacked drops, and blocks stopped by solid terrain.

- [x] Implement same-color block merging.
  - Files: `games/raskulls/src/systems/terrain.ts`, `games/raskulls/test/terrain.test.ts`
  - After gravity resolves, flood-fill adjacent same-color blocks.
  - Represent merged groups as one logical block group, or simulate merging by clearing matching blocks together when struck.
  - Add tests for horizontal, vertical, and L-shaped color groups.

- [x] Implement gray-block chain explosions.
  - Files: `games/raskulls/src/systems/terrain.ts`, `games/raskulls/src/scenes/PlayScene.ts`, `games/raskulls/test/terrain.test.ts`
  - Detect connected gray groups of four or more after gravity/merge resolution.
  - Clear the entire connected gray group and trigger break effects for each tile.
  - Re-run gravity and chain detection until no more explosions are possible.

- [x] Change wand breaking from "one adjacent tile" to source-like block/group breaking.
  - Files: `games/raskulls/src/scenes/PlayScene.ts`, `games/raskulls/src/systems/terrain.ts`
  - Keep directional targeting: forward, up, and down.
  - When the target is a merged group, break the whole group.
  - Keep steel/stone blocks indestructible and provide a clear failed-hit effect.

### Phase 2 — Frenzy and pacing

- [x] Replace the one-shot `dash` pickup with Boosties and a Frenzy meter.
  - Files: `games/raskulls/src/systems/types.ts`, `games/raskulls/src/scenes/PlayScene.ts`, `games/raskulls/src/scenes/RaceScene.ts`, `games/raskulls/src/assets.ts`
  - Track `frenzyEnergy`, `frenzyActive`, and `frenzyDrainRate` per player.
  - Collecting Boosties fills the meter.
  - Pressing the power button activates Frenzy when the meter is above the minimum threshold.
  - While active, increase run speed and acceleration, drain energy, and add a visual trail.

- [x] Tune movement around racing, not arena fighting.
  - Files: `games/raskulls/src/scenes/PlayScene.ts`
  - Split normal run speed, Frenzy speed, jump strength, fall speed, stun time, and collision knockback into named mode-tuning constants.
  - Add race-first tuning: fast horizontal response, short stun windows, and low punishment for hazards.
  - Keep values easy to tune from one object rather than scattered constants.

- [x] Change hazards from lethal by default to slowdown/bonus loss in race modes.
  - Files: `games/raskulls/src/scenes/PlayScene.ts`
  - Lava/spikes should usually slow, bounce, drain Frenzy, or remove held powerups.
  - Reserve actual elimination/lives behavior for any explicit battle-style mode.
  - Add tests or scene-level fixtures for hazard effect selection by mode.

### Phase 3 — Original-style race and challenge modes

- [x] Replace the current single `Race` level with a level catalog.
  - Files: `games/raskulls/src/systems/levels.ts`, `games/raskulls/src/scenes/RaceScene.ts`
  - Define a `LevelDefinition` format with name, mode type, terrain layout, starts, finish/objectives, time limit, pickup placement, and hazard rules.
  - Start with three race tracks that exercise core block mechanics: simple dig race, vertical dig climb, and gray-chain shortcut route.

- [x] Add a Grand Prix-style playlist flow.
  - Files: `games/raskulls/src/scenes/ModeSelectScene.ts`, `games/raskulls/src/scenes/ResultsScene.ts`, `games/raskulls/src/session.ts`
  - Queue multiple levels.
  - Award points per race placement.
  - Show standings between rounds and final results after the playlist.

- [x] Add challenge variants inspired by the original game.
  - Files: `games/raskulls/src/systems/levels.ts`, new scene or mode logic under `games/raskulls/src/scenes/`
  - Priority variants:
    - Time Trial: fastest finish wins.
    - Ammo Scrooge-like: limited wand uses, so players must plan block breaks.
    - Bomb Disposal-like: reach or clear bomb targets before time expires.
    - Frenzy Run: keep Frenzy active by chaining Boosties.
  - Implement these as objective rules over the same core `PlayScene`, not as four fully separate engines.

- [x] Add optional bot players for quick race fills.
  - Files: `games/raskulls/src/scenes/PlayScene.ts`, new AI helper under `games/raskulls/src/systems/`
  - Start with simple path-following and dig-if-blocked behavior.
  - Bots only need to be competent enough to pressure solo players during testing.

### Phase 4 — Powerups and player disruption

- [ ] Expand powerups beyond `bomb` and `shield`.
  - Files: `games/raskulls/src/systems/terrain.ts`, `games/raskulls/src/scenes/PlayScene.ts`, `games/raskulls/src/assets.ts`
  - Keep `bomb` and `shield`, but tune them for race disruption.
  - Add at least two more race-friendly offensive/defensive items: stun projectile, swap/slow trap, block-clear burst, or temporary invulnerability.
  - Make held powerup UI icon-based instead of text labels.

- [ ] Make player collisions feel like disruption, not deathmatch combat.
  - Files: `games/raskulls/src/scenes/PlayScene.ts`
  - Dashing/Frenzy should shove or stun opponents briefly.
  - Shield should negate disruption and possibly reflect shove.
  - Regular body overlap should separate players without dramatic knockback.

- [ ] Update scoring to match mode goals.
  - Files: `games/raskulls/src/systems/scoring.ts`, `games/raskulls/test/scoring.test.ts`
  - Race ranking should prioritize finish position/time.
  - Grand Prix ranking should use round points.
  - Challenge modes should rank by their objective: remaining wand uses, bombs cleared, Frenzy uptime, or finish time.
  - Gems/blocks should be secondary tie-breakers, not core scoring for every mode.

### Phase 5 — Presentation and world identity

- [ ] Replace code-generated placeholder sprites with a coherent Raskulls-like art direction.
  - Files: `games/raskulls/src/assets.ts`, `games/raskulls/src/style.css`, possible new files under `games/raskulls/public/`
  - Use expressive skull characters, chunky bright block tiles, readable Boosties, and punchy break effects.
  - Avoid copying protected original assets directly; create original lookalike-inspired assets.

- [ ] Add named character variants.
  - Files: `games/raskulls/src/assets.ts`, `games/raskulls/src/scenes/ModeSelectScene.ts`
  - Add simple variants inspired by archetypes such as King, Ninja, Dragon, Wizard, and Pirat.
  - Tie each local player color/profile to a selected character skin.
  - Add small expression changes for idle, running, stunned, Frenzy, and finish states.

- [ ] Add light story framing and humor without blocking quick play.
  - Files: `games/raskulls/src/scenes/ModeSelectScene.ts`, `games/raskulls/src/scenes/ResultsScene.ts`
  - Add quick pre-race title cards, rivalry blurbs, and round result quips.
  - Keep it skippable and short because this is a party shell game.

- [ ] Improve camera and split-screen behavior.
  - Files: `games/raskulls/src/scenes/PlayScene.ts`
  - Current shared camera can make race spacing awkward.
  - Evaluate dynamic split-screen or rubber-band camera constraints for far-apart players.
  - Prevent finished players from making the camera abandon active players.

### Phase 6 — Validation

- [ ] Build a mechanical accuracy test suite.
  - Files: `games/raskulls/test/terrain.test.ts`, `games/raskulls/test/scoring.test.ts`, new tests as needed
  - Cover block gravity, merging, gray-chain explosions, Frenzy fill/drain, hazard rules, and playlist scoring.
  - Keep most logic tests outside Phaser scenes so they run fast in Vitest.

- [ ] Add manual playtest scenarios.
  - Files: new `games/raskulls/PLAYTEST.md`
  - Scenario 1: four-player race with block shortcuts.
  - Scenario 2: Frenzy route where Boostie placement decides the fastest line.
  - Scenario 3: gray-block chain shortcut.
  - Scenario 4: powerup disruption without unfair instant death.

- [ ] Capture tuning notes after every playtest.
  - Files: new `games/raskulls/TUNING.md`
  - Track speed, jump, wand cooldown, Frenzy drain, pickup density, race length, and camera issues.
  - Record exact values before changing them so tuning stays reversible.

### Suggested implementation order

1. Add structured terrain cells and tests.
2. Implement block gravity, merging, and gray-chain explosions.
3. Replace dash with Boosties/Frenzy.
4. Rebuild the first race level around the new block mechanics.
5. Add Grand Prix playlist scoring.
6. Expand challenge variants.
7. Polish powerups, characters, camera, and presentation.
