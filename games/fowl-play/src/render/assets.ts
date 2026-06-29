/// <reference types="vite/client" />
/**
 * Loads the Fowl Play image assets from `public/`. Images load asynchronously;
 * the renderer checks `ready()` per-image and falls back to the programmer-art
 * primitives until each is available, so the game stays fully playable before
 * art loads (or if an asset is missing). Mirrors the pong asset loader.
 */
import type { PieceId } from "../types.js";

const BASE = import.meta.env.BASE_URL;

function load(name: string): HTMLImageElement | null {
  // Guard for non-DOM environments (e.g. vitest node) — the renderer is never
  // constructed there, but keep asset loading from throwing if it ever is.
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.src = `${BASE}${name}`;
  return img;
}

export const IMG = {
  chicken: load("chicken.png"),
  skull: load("skull.png"),
  cursor: load("cursor.png"),
  grid: load("placement-grid.png"),
  wordmark: load("wordmark.png"),
  hudClock: load("hud-clock.png"),
  chipBg: load("hud-player-chip-bg.png"),
  bannerPlacement: load("phase-banner-placement.png"),
  bannerRace: load("phase-banner-race.png"),
  bannerScore: load("phase-banner-score.png"),
  // Static piece sprites.
  plank: load("piece-plank.png"),
  block: load("piece-block.png"),
  spike: load("piece-spike.png"),
  saw: load("piece-saw.png"),
  coin: load("piece-coin.png"),
  diamond: load("piece-diamond.png"),
  ice: load("piece-ice.png"),
  bouncy: load("piece-bouncy.png"),
  conveyor: load("piece-conveyor.png"),
  coals: load("piece-coals.png"),
  fan: load("piece-fan.png"),
  puck: load("piece-puck.png"),
  crusher: load("piece-crusher.png"),
  mace: load("piece-mace.png"),
  pendulum: load("piece-pendulum.png"),
  log: load("piece-log.png"),
  ladder: load("piece-ladder.png"),
  trampoline: load("piece-trampoline.png"),
  // Arena backgrounds.
  bgBarnyard: load("bg-barnyard.png"),
  bgSilo: load("bg-silo.png"),
  bgWindmill: load("bg-windmill.png"),
} as const;

/**
 * A horizontal sprite-sheet strip. Frame size is derived from the loaded image
 * (`naturalWidth / frames`) so 1× or 2× exports both work.
 */
export interface Sheet {
  img: HTMLImageElement | null;
  frames: number;
}

export const SHEET = {
  chickenIdle: { img: IMG.chicken, frames: 1 },
  chickenRun: { img: load("chicken-run.png"), frames: 6 },
  chickenJump: { img: load("chicken-jump.png"), frames: 3 },
  coinSpin: { img: load("coin-spin.png"), frames: 8 },
} satisfies Record<string, Sheet>;

/** Static piece sprites keyed by piece id. Saw/coin/diamond are drawn specially. */
const PIECE_IMG: Partial<Record<PieceId, HTMLImageElement | null>> = {
  plank: IMG.plank,
  block: IMG.block,
  spike: IMG.spike,
  ice: IMG.ice,
  bouncy: IMG.bouncy,
  conveyor: IMG.conveyor,
  coals: IMG.coals,
  fan: IMG.fan,
  puck: IMG.puck,
  crusher: IMG.crusher,
  mace: IMG.mace,
  pendulum: IMG.pendulum,
  log: IMG.log,
  ladder: IMG.ladder,
  trampoline: IMG.trampoline,
};

/** Arena background sprites keyed by arena id (only the ones with art). */
const ARENA_BG: Record<string, HTMLImageElement | null> = {
  barnyard: IMG.bgBarnyard,
  silo: IMG.bgSilo,
  windmill: IMG.bgWindmill,
};

export function pieceImage(id: PieceId): HTMLImageElement | null {
  return PIECE_IMG[id] ?? null;
}

export function arenaBg(id: string): HTMLImageElement | null {
  return ARENA_BG[id] ?? null;
}

export function ready(img: HTMLImageElement | null): img is HTMLImageElement {
  return img != null && img.complete && img.naturalWidth > 0;
}

const tintCache = new Map<string, HTMLCanvasElement>();

/**
 * Returns a recolored copy of a white/grayscale image, tinted to `color` while
 * preserving its alpha. Results are cached (few player colors), so this is cheap
 * to call every frame.
 */
export function tinted(img: HTMLImageElement, color: string): HTMLCanvasElement {
  const key = `${img.src}|${color}`;
  const cached = tintCache.get(key);
  if (cached) return cached;

  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const cx = c.getContext("2d")!;
  cx.drawImage(img, 0, 0);
  cx.globalCompositeOperation = "source-in";
  cx.fillStyle = color;
  cx.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, c);
  return c;
}
