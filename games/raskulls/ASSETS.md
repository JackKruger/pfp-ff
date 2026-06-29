# Raskulls — Asset Handoff

Raskulls currently ships with procedural Phaser textures, so the game is fully
playable without PNG art. Real assets can now be dropped into
`games/raskulls/public/art/` and enabled in `public/art/manifest.json`.

## Loading Contract

- Keep texture keys exactly as listed in `manifest.json`.
- Set top-level `"enabled": true` in `manifest.json`.
- Set `"enabled": true` only for PNGs that exist.
- Any missing or disabled texture falls back to the current procedural art.
- Transparent PNGs are preferred for characters, pickups, hazards, and effects.
- Tile PNGs should be opaque or nearly opaque so terrain reads clearly.

## Required Sizes

### Characters

Use 32x36 transparent PNGs. Keep the feet/body centered around the existing
collision box; do not add large empty padding.

- `player-default.png` -> `raskulls-player`
- `player-king.png` -> `raskulls-player-king`
- `player-ninja.png` -> `raskulls-player-ninja`
- `player-dragon.png` -> `raskulls-player-dragon`
- `player-wizard.png` -> `raskulls-player-wizard`
- `player-pirat.png` -> `raskulls-player-pirat`

### Terrain

Use 32x32 PNGs. These are placed on a tile grid and must not rely on extra
overhang outside the tile.

- `tile-dirt.png` -> `raskulls-dirt`
- `tile-stone.png` -> `raskulls-stone`
- `tile-crate.png` -> `raskulls-crate`
- `tile-red.png` -> `raskulls-block-red`
- `tile-blue.png` -> `raskulls-block-blue`
- `tile-yellow.png` -> `raskulls-block-yellow`
- `tile-green.png` -> `raskulls-block-green`
- `tile-gray.png` -> `raskulls-block-gray`
- `tile-finish.png` -> `raskulls-finish`

### Pickups And Powers

Use 32x32 transparent PNGs. Silhouettes need to read at a glance during motion.

- `pickup-gem.png` -> `raskulls-gem`
- `pickup-boostie.png` -> `raskulls-boostie`
- `power-dash.png` -> `raskulls-dash`
- `power-bomb.png` -> `raskulls-bomb`
- `power-shield.png` -> `raskulls-shield`
- `power-stun-bolt.png` -> `raskulls-stun-bolt`
- `power-burst.png` -> `raskulls-burst`
- `hazard-spikes.png` -> `raskulls-spikes`

## Art Direction

- Original skull-racer art only; do not copy Raskulls/XBLA assets.
- Keep the existing arcade palette: amber highlights, deep blue shadows, chunky
  readable blocks, bright powerups.
- Terrain blocks should be high contrast but less visually loud than players and
  pickups.
- Character variants should share a consistent body/face silhouette so player
  tinting and collision expectations still feel stable.
