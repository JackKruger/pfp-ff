# Raskulls Tuning Notes

All tuning constants live in `games/raskulls/src/scenes/PlayScene.ts` inside the `MODE_TUNING` object. Change values there; the game references them at runtime so a rebuild is all that's needed.

---

## Current Values

### Movement

| Constant | Race | Arena | What it controls |
|---|---|---|---|
| `runSpeed` | 250 | 220 | Base horizontal speed in pixels/second. Lower = more deliberate; higher = frantic. |
| `frenzyRunMultiplier` | 1.34 | 1.28 | Multiplies `runSpeed` while Frenzy is active. 1.34 = 34% faster. |
| `jumpSpeed` | 500 | 500 | Upward velocity (px/s) applied when jumping. Higher = more floaty. |
| `gravity` | 1420 | 1450 | Downward acceleration in px/s². Higher = snappier falls. |
| `maxFallSpeed` | 740 | 720 | Terminal velocity (px/s). Caps how fast players fall. |

### Wand (dig)

| Constant | Race | Arena | What it controls |
|---|---|---|---|
| `wandCooldownMs` | 160 | 180 | Minimum milliseconds between wand uses. Lower = faster digging. |

### Frenzy meter

| Constant | Value | Location | What it controls |
|---|---|---|---|
| `frenzyDrainRate` | 34 (race), 40 (arena) | `ModeTuning` | Frenzy energy lost per second while active. Higher = shorter bursts. |
| `FRENZY_MIN_ACTIVATE` | 30 | Top of `PlayScene.ts` | Minimum energy required to activate Frenzy. |
| `FRENZY_BOOSTIE_ENERGY` | 35 | Top of `PlayScene.ts` | Energy gained per Boostie collected. |
| `FRENZY_MAX_ENERGY` | 100 | Top of `PlayScene.ts` | Energy cap. |

**Balance note**: With `boostieEnergyGain = 35` and `frenzyDrainRate = 34`, one Boostie gives ~1 second of Frenzy (35 / 34 ≈ 1.03 s). Two Boosties give ~2 seconds. Adjust `boostieEnergyGain` to change how many Boosties are needed for a meaningful burst.

### Knockback and stun

| Constant | Race | Arena | What it controls |
|---|---|---|---|
| `overlapKnockbackX` | 55 | 90 | Speed (px/s) of the bounce when two players overlap without Frenzy. |
| `frenzyHitKnockbackX` | 240 | 360 | Horizontal speed of the victim after a Frenzy shove. |
| `frenzyHitKnockbackY` | 170 | 260 | Upward speed of the victim after a Frenzy shove. |
| `respawnStunMs` | 260 | 350 | Stun duration after respawning. |
| `frenzyHitStunMs` | 360 | 650 | Stun duration after receiving a Frenzy shove. |

**Shield reflect**: When a Frenzy player hits a shielded player, the attacker receives 55% of `frenzyHitKnockbackX` in the reverse direction and 45% of `frenzyHitKnockbackY` upward (no stun). Adjust the multipliers in `resolveHit()` in `PlayScene.ts`.

### Hazard effects (race mode)

Defined in `games/raskulls/src/systems/hazards.ts`:

| Effect | Race value | Arena value |
|---|---|---|
| `lethal` | false | true |
| `stunMs` | 180 ms | 0 ms |
| `bounceY` | 230 px/s | 0 |
| `speedMultiplier` | 0.25 | 1.0 |
| `frenzyDrain` | 24 | 0 |
| `clearPowerup` | true | false |

**Hazard cooldown**: 700 ms (hardcoded in `applyHazard`, `PlayScene.ts`). Prevents rapid repeat hazard triggers on the same player.

### Stun projectile (StunBolt)

| Constant | Value | What it controls |
|---|---|---|
| `STUN_BOLT_RANGE` | 320 px | Maximum horizontal range of the bolt. |
| `STUN_BOLT_LANE_HEIGHT` | 92 px | Vertical window the target must be within. |
| `STUN_BOLT_STUN_MS` | 700 ms | Stun duration on the target. |
| `STUN_BOLT_FRENZY_DRAIN` | 24 | Frenzy energy drained from the target. |

### Race timeouts

| Level | Timeout |
|---|---|
| Dig Rush | 120 s |
| Cliff Climb | 130 s |
| Gray Gambit | 125 s |

### Arena

| Constant | Value |
|---|---|
| Arena duration | 90 s (set in `createArenaLevel()` in `levels.ts`) |
| Arena lives per player | 3 |

### Grand Prix points

| Place | Points |
|---|---|
| 1st | 5 |
| 2nd | 3 |
| 3rd | 2 |
| 4th | 1 |

Defined as `POINTS_BY_PLACE` in `games/raskulls/src/systems/playlist.ts`.

---

## How to Tune

### If the game feels too slow
Increase `runSpeed` in `race` tuning (try 270–300). Reduce `wandCooldownMs` to 120 to speed up digging.

### If Frenzy is too dominant
Lower `frenzyRunMultiplier` (try 1.2) or raise `frenzyDrainRate` (try 45). Reducing `FRENZY_BOOSTIE_ENERGY` means more Boosties are needed per burst.

### If knockback feels too lethal
Lower `frenzyHitKnockbackX` and `frenzyHitKnockbackY` in `race` tuning. Reduce `frenzyHitStunMs` to shorten the recovery window.

### If the camera zooms out too far
The min zoom cap is `0.45` in `updateCamera()` in `PlayScene.ts`. Raise it to `0.5` or `0.55` if players feel too small. The max zoom cap is `1.0` — lower this if the camera feels too close on solo play.

### If hazards in race mode feel too punishing
Reduce `frenzyDrain` in `RACE_HAZARD_EFFECT` (try 12) or raise `speedMultiplier` (try 0.4). Increase `stunMs` only if the bounce animation needs more time to look right.

### Things not to break
- `FRENZY_MIN_ACTIVATE` must stay below `FRENZY_BOOSTIE_ENERGY` or players can never activate Frenzy after collecting one Boostie.
- `overlapKnockbackX` in race mode should stay well below `frenzyHitKnockbackX`; if they're equal, Frenzy shoves feel the same as regular bumps.
- Race timeouts must be long enough for the longest reasonable run + a few failed attempts. 120 s is tight on Dig Rush for first-time players.

---

## Change Log

*Record exact values before and after each playtest session here so tuning stays reversible.*

| Date | Constant | Old | New | Reason |
|---|---|---|---|---|
| (fill in) | — | — | — | — |
