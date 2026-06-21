# Party Mix — Asset Wishlist

The game is fully playable **without any of these** — everything currently draws
procedurally (canvas shapes, system fonts, emoji). These are drop-in upgrades.
All art should be original (no ripped Mario Party assets). Transparent PNG or SVG
unless noted; sizes are at 1× — provide @2× for crispness if easy.

## Priority — board & pawns

- [ ] **Player pawn sprites** — 4 characters, one per player color
      (`#ef4444` red, `#3b82f6` blue, `#22c55e` green, `#f59e0b` amber).
      ~96×96 px each, top-down or 3/4 view, idle pose. A small "hop" frame would
      be a bonus for the move animation (Phase 5).
- [ ] **Board tile icons** — one small glyph per tile kind, ~64×64:
      `blue` (+coins), `red` (−coins), `star`, `event` (?), `start`.
      Currently text glyphs (`+3`, `−3`, `☆`, `?`, `★`).
- [ ] **Coin icon** — ~48×48, used in HUD and payouts (currently `◉`).
- [ ] **Star icon** — ~48×48, the win-condition currency (currently `☆`).
- [ ] **Die faces / die sprite** — a clean cube or a 1–9 numbered token,
      ~256×256. Optional; the current white rounded square reads fine.

## Priority — backgrounds

- [ ] **Board background** — a tileable or full 1920×1080 backdrop the ring sits
      on (grass/lava/candy "world" themes welcome). Subtle; must not fight the
      tiles. Currently flat `#0a0b14`.
- [ ] **Minigame backdrops** — one per minigame, full-screen 1920×1080:
  - Quickdraw: a duel/standoff scene (the screen flips red→green on "go").

## Nice-to-have — UI & polish

- [ ] **Medal icons** — 🥇🥈🥉 replacements for the results screen, ~64×64.
- [ ] **Card frame / panel texture** — for the intro / round-end / results
      overlays (currently translucent dark rectangles).
- [ ] **Wordmark** — a "Party Mix" logo for the intro card (currently bold text).

## Audio (optional — we synthesize beeps via WebAudio today)

- [ ] dice roll/lock, coin pickup, "bad" (lose coins), round fanfare, win jingle.
- [ ] short minigame stingers: countdown tick + "GO!" for Quickdraw.

## Upcoming (will need art as these phases land)

- [ ] Tug-of-War & Coin Grab / Hot Potato minigame art (Phase 3).
- [ ] Star-tile and event-tile flourishes (Phase 4).

> When you drop files in, put them under `games/party-mix/public/` and tell me —
> I'll wire them into `render.ts` / the minigames and remove the procedural
> placeholders.
