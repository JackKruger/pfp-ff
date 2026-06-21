/// <reference types="vite/client" />
/**
 * Loads the Pong image assets from `public/`. Images load asynchronously; the
 * renderer checks `ready()` per-image and falls back to primitive drawing until
 * each is available, so the game is fully playable even before art loads (or if
 * an asset is missing).
 */
const BASE = import.meta.env.BASE_URL;

function load(name: string): HTMLImageElement {
  const img = new Image();
  img.src = `${BASE}${name}`;
  return img;
}

export const IMG = {
  bg: load("bg-playfield.png"),
  ball: load("ball-glow.png"),
  paddle: load("paddle.png"),
  spark: load("spark.png"),
  scanlines: load("scanlines.png"),
  vignette: load("vignette.png"),
  wordmark: load("pong-wordmark.png"),
  net: load("center-net.png"),
  goalFlash: load("goal-flash.png"),
  digits: load("digits.png"),
} as const;

export function ready(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0;
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
