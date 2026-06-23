# Art requests — PFP-FF launcher

These are the images the shell home screen needs to replace the generated
placeholders. Until they land, the launcher falls back to an intentional
gradient + emoji placeholder per game (so nothing looks broken), but real
cover art is what takes it from "prototype" to "arcade."

## Conventions

- **Card thumbnails:** all the same aspect ratio so the shelf is uniform.
  - Aspect ratio: **16:10**
  - Export size: **1024 × 640 px**, PNG
  - Composition: hero subject roughly centered, safe margin around edges (the
    card crops with `object-fit: cover` and zooms 6% on hover/focus).
  - Drop into: `apps/shell/public/thumbnails/<id>.png`
  - Then set `thumbnail: "/thumbnails/<id>.png"` on that game in
    `apps/shell/src/games.ts` (already wired for pong, stick-fight, party-mix).
- **Hero banner art:** wide art for the featured game (currently Raskulls).
  - Aspect ratio: **21:9**-ish wide
  - Export size: **1280 × 560 px**, PNG
  - Right ~60% is visible; the left edge feathers into the panel, so keep the
    focal subject on the **right half**.
  - Drop into: `apps/shell/public/hero/<id>.png` (new folder).

Each game has a signature neon accent — please lean into it so the wall of
cards feels color-coded and alive.

## Missing card thumbnails (highest priority — these show placeholders now)

1. **Raskulls** — `thumbnails/raskulls.png` — accent **amber `#f59e0b`**
   - Chaotic block-breaking race. Cartoon skull-headed racers dashing through
     a crumbling block maze, gems flying, finish-line energy. Bright, playful,
     high-contrast. Amber/orange dominant with cool blue accents.

2. **Space Invaders** — `thumbnails/space-invaders.png` — accent **green `#22c55e`**
   - Co-op arcade defense. Rows of glowing green pixel-art alien invaders
     descending toward 1–4 player cannons firing upward. Neon green on deep
     space black, retro CRT vibe, subtle scanlines.

3. **Iron Yard** — `thumbnails/iron-yard.png` — accent **orange `#f97316`**
   - Medieval physics brawler. Ragdoll knights in a torch-lit forge/yard
     swinging oversized hand-forged weapons, sparks flying. Gritty, warm
     orange firelight against dark stone.

## Optional — re-render for consistency (these have art but it's inconsistent)

The existing pong / stick-fight / party-mix thumbnails are different crops and
heights. Re-export them at **1024 × 640 (16:10)** for a uniform shelf:

4. **Pong** — `thumbnails/pong.png` — accent **blue `#4f9dff`**
   - Neon table-tennis duel: two glowing paddles, a streaking ball with a
     light trail, electric-blue/orange contrast. (Current art is close — just
     reframe to 16:10.)

5. **Stick Fight** — `thumbnails/stick-fight.png` — accent **magenta `#ff3b6b`**
   - Ragdoll stick figures brawling with absurd weapons on a neon stage,
     hot magenta/red energy. (Reframe to 16:10.)

6. **Party Mix** — `thumbnails/party-mix.png` — accent **purple `#c084fc`**
   - Confetti-filled board-game chaos, stars and coins, 4 colorful characters,
     purple/violet party lighting. (Reframe to 16:10.)

## Optional — hero banner art

7. **Raskulls hero** — `hero/raskulls.png` — 1280 × 560, amber accent
   - Wide cinematic version of the Raskulls card: a racer mid-dash bursting
     through blocks, motion blur, gems trailing. Keep the subject on the right
     half (left edge fades into the dark panel). Once added, set a
     `heroArt` field or point the hero at it.

## Notes for whoever wires these in

- `apps/shell/src/games.ts` is the single source of truth; each game already
  carries `accent`, `icon`, `category`, and `blurb` used by the UI.
- The placeholder system (`.game-card__placeholder` in `style.css`) stays as
  the permanent fallback for any future game added without art.
