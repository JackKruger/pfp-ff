# Pong — Art Assets Needed

To replace the current flat-rect / canvas-text rendering with a polished look.

**Art direction:** glowing neon-on-dark, cohesive with the shell (near-black
`#05060a` background, slate UI, player colors red/blue/green/amber). All
transparent PNGs unless noted. Sized for the 1280×720 logical canvas; exporting
at 2× is fine for crispness. Drop files in `games/pong/public/`.

**Important for the generator:**

- `paddle.png` and `goal-flash.png` must be **white / grayscale on transparent**
  so the code can tint them to each player's color. Do not bake in a color.
- Glow assets (`ball-glow.png`, `spark.png`) want a transparent background and
  soft falloff, designed to be drawn additively.

---

## Tier 1 — biggest visual payoff

- [ ] `bg-playfield.png` — 1280×720, opaque. Arena background: dark gradient +
      subtle vignette, faint grid or perspective floor.
- [ ] `ball-glow.png` — 64×64, transparent. Soft white glowing orb (bloom/halo).
      Used for the ball **and** the trail (scaled + faded).
- [ ] `paddle.png` — 36×240, transparent, **tintable** (white + inner glow,
      rounded caps, vertical).
- [ ] `spark.png` — 32×32, transparent. Soft circular white spark for particles
      (additive glow); replaces the flat squares.

## Tier 2 — atmosphere & identity

- [ ] `scanlines.png` — 256×256, **tileable**. CRT scanline/noise overlay drawn
      over everything at ~3–5% opacity.
- [ ] `vignette.png` — 1280×720, transparent. Edge-darkening overlay for depth.
- [ ] `pong-wordmark.png` — ~800×260, transparent. Stylized "PONG" logo for the
      attract screen (neon/chrome).
- [ ] `center-net.png` — 24×720, transparent. Glowing dashed center divider
      (replaces the CSS dashes).

## Tier 3 — polish

- [ ] `goal-flash.png` — 400×720, transparent, **tintable**. Colored edge-flare
      shown on a player's wall when they're scored on.
- [ ] `digits.png` — sprite sheet, 10 frames of 96×128. Retro 7-seg / arcade
      numerals 0–9 for the score (optional; nicer than the system font).
- [ ] `thumbnail.png` — 220×160. Improved game-card thumbnail to replace the
      current `apps/shell/public/thumbnails/pong.png`.

---

Once the art lands, `render.ts` is a clean swap — it already has the draw points
for ball, paddles, particles, trail, center line, and overlays, so wiring images
in (with per-player tint + graceful fallback to rects) is straightforward.
