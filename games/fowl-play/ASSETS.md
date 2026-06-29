# Fowl Play — Art Assets Needed

A running checklist of textures/sprites the game needs. **The game runs without
any of these** — fallbacks are programmer-art primitives drawn on Canvas2D.
Treat this as a "drop it in when you have it" list rather than a blocker.

> Status legend: `[ ]` = not started, `[wip]` = sketched, `[x]` = in repo at the
> listed path. Sizes assume a **1280×720 logical canvas**, exporting at 2× is
> fine for crispness.

**Art direction (v1):**
- Cohesive with the shell — dark backgrounds (`#05060a`), bright primary fills,
  high contrast.
- Cartoon-flat. No shading gradients on gameplay objects so silhouettes read
  fast on a busy screen.
- Players are circles, **tintable** to the slot color
  (`#ef4444`/`#3b82f6`/`#22c55e`/`#f59e0b`).
- Hazards have a distinct silhouette — a player should know at a glance what
  will kill them.
- All transparent PNGs unless noted. Drop files in `games/fowl-play/public/`.

**Important for the tint pipeline:**
- Anything marked **tintable** must be white/grayscale on transparent — code
  multiplies the slot color in. Do not bake in a hue.

---

## Tier 1 — biggest visual payoff

### Characters
- [x] `chicken.png` — 64×64, transparent, **tintable**. Round chicken-ish
      silhouette, idle frame. Replaces the player circle. Will be used as base
      for animation sheet later.
- [x] `skull.png` — 32×32, transparent, **tintable**. Drops at the death
      position to mark where a player died this round.

### Arena backgrounds (1 per arena)
- [x] `bg-barnyard.png` — 1920×1080, opaque. Wide farm pasture, hay bales,
      distant fence. Wider than canvas because camera pans.
- [x] `bg-silo.png` — 1080×1920, opaque. Tall silo interior, planks and
      rafters. Portrait because arena is vertical.
- [x] `bg-windmill.png` — 1920×1280, opaque. Windmill exterior, sky, hills.

### Piece sprites — Tier 1 (most-placed, ugliest as rects)
- [x] `piece-plank.png` — 96×16, transparent. Wooden plank with grain.
- [x] `piece-block.png` — 32×32, transparent. Small stone/wood block.
- [x] `piece-spike.png` — 64×16, transparent. Row of upward iron spikes; the
      lethal surface is the top edge only.
- [x] `piece-saw.png` — 64×64, transparent. Spinning saw blade with hub. We
      rotate it in code (provide just one frame).
- [x] `piece-coin.png` — 32×32, transparent. Gold coin, slight rim.

## Tier 2 — finish the piece library

- [ ] `piece-ice.png` — 64×32, transparent. Glossy ice block with highlight.
- [ ] `piece-bouncy.png` — 64×16, transparent. Springy red/white pad.
- [ ] `piece-conveyor.png` — 96×16, transparent. Belt with arrows (we mirror in
      code for direction).
- [ ] `piece-crusher.png` — 48×48, transparent. Heavy iron weight with chain
      texture.
- [ ] `piece-coals.png` — 48×16, transparent. Glowing coals with subtle flame
      hints baked in.
- [ ] `piece-fan.png` — 48×48, transparent. Caged fan, blades visible.
- [ ] `piece-puck.png` — 32×32, transparent. Hockey puck top-down.
- [ ] `piece-mace.png` — 48×16 (head) + chain segment 8×8 tileable, transparent.
- [ ] `piece-pendulum.png` — 96×16, transparent. Like the plank but with pivot
      ring at top-center.
- [ ] `piece-log.png` — 16×96, transparent. Vertical wooden log.
- [ ] `piece-trampoline.png` — 48×16, transparent. Stretched canvas with frame.
- [ ] `piece-ladder.png` — 16×96, transparent. Wooden ladder, rungs visible.
- [ ] `piece-diamond.png` — 40×40, transparent. Faceted gem with sparkle.

## Tier 3 — UI & polish

### Phase / HUD elements
- [ ] `hud-clock.png` — 64×64, transparent. Round timer face; we draw the hand
      in code. Used for placement & race timers.
- [ ] `hud-player-chip-bg.png` — 240×72, transparent, **tintable**. Background
      for each player's score chip in the top HUD.
- [ ] `phase-banner-placement.png` — 600×120, transparent. "Place your trap!"
      banner shown for 1s at phase start. (Optional — fall back to text.)
- [ ] `phase-banner-race.png` — 600×120, transparent. "GO!" banner.
- [ ] `phase-banner-score.png` — 600×120, transparent. "Round results" banner.

### Cursor / placement
- [ ] `cursor.png` — 32×32, transparent, **tintable**. Reticle for each
      player's placement cursor. We tint per-slot.
- [ ] `placement-grid.png` — 32×32, **tileable**, transparent. Subtle grid dot
      pattern for the placement overlay so players can see the snap.

### Marketing / catalog
- [x] `thumbnail.png` — 220×160. Game-card thumbnail used by the shell
      library. Place at `apps/shell/public/thumbnails/fowl-play.png`.
- [ ] `hero-art.png` — 1280×360, opaque/transparent OK. Wide art for the
      shell's featured hero banner (only if we promote to featured).
- [ ] `wordmark.png` — ~800×260, transparent. Stylized "FOWL PLAY" logo for the
      attract / pre-launch screen.

## Tier 4 — animation sheets (post-MVP polish)

When we move past programmer-art:

- [ ] `chicken-run.png` — 6 frames × 64×64, sprite sheet, **tintable**.
- [ ] `chicken-jump.png` — 3 frames × 64×64 (rise/peak/fall), **tintable**.
- [ ] `chicken-die.png` — 4 frames × 64×64. Squish/poof. **Tintable**.
- [ ] `saw-spin.png` — 8 frames × 64×64 if we'd rather pre-render the spin than
      rotate in code.
- [ ] `crusher-fall.png` — 4 frames × 48×48 anticipation/drop.
- [ ] `coin-spin.png` — 8 frames × 32×32 spin animation.

---

## Notes for handoff

- The game renders to a logical 1280×720 canvas and scales to the iframe.
  Backgrounds wider/taller than 1280×720 are fine and expected for the arenas
  the camera pans over.
- Player colors used by the platform (do not bake into sprites; we tint):
  P1 `#ef4444` · P2 `#3b82f6` · P3 `#22c55e` · P4 `#f59e0b`.
- Hazard silhouettes are gameplay-critical: lethal pieces should look
  unambiguously sharp/aggressive even at small zoom levels.
- If a piece's lethal surface is direction-specific (spike strip kills from
  *above* only), please make the dangerous side visually distinct (spikes up,
  flat bottom).
- When a piece's *behaviour* is direction-dependent (Conveyor, Fan), supply
  one orientation and we'll mirror/rotate in code.

When art lands, the render layer is a clean swap — every drawable goes through
`render/canvas.ts` with a `drawPiece(kind, x, y, rot)` style call, so wiring
images in (with per-player tint + graceful fallback to the current
programmer-art rect) is a few lines per piece.
