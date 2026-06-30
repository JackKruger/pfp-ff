/**
 * Engine-agnostic split-screen layout math.
 *
 * Given a number of player panes and a screen size, returns the rectangle for
 * each pane. The result carries no rendering assumptions, so it can drive Phaser
 * cameras, raw-canvas clip regions, or any other host. Callers decide which
 * player a pane belongs to via the 0-based `index`.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Viewport {
  /** 0-based pane position; index into the caller's player list. */
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SplitLayoutOptions {
  /** Pixels trimmed from every edge of each pane, leaving room for dividers. */
  gap?: number;
}

/**
 * Compute split-screen viewports for `count` panes within `screen`.
 *
 * - 1 -> one full-screen pane.
 * - 2 -> side-by-side (left/right halves).
 * - 3 -> two half-width panes on top, one full-width pane on the bottom.
 * - 4 -> 2x2 quadrant grid.
 *
 * `count` is clamped to 1..4; values above 4 use the 4-pane grid (extras are
 * dropped), and values below 1 produce a single full-screen pane.
 */
export function computeSplitLayout(
  count: number,
  screen: Size,
  options: SplitLayoutOptions = {},
): Viewport[] {
  const gap = Math.max(0, options.gap ?? 0);
  const panes = Math.min(4, Math.max(1, Math.floor(count) || 1));
  const { width: w, height: h } = screen;
  const halfW = w / 2;
  const halfH = h / 2;

  // Raw (ungapped) cells, in pane order.
  let cells: Array<Omit<Viewport, "index">>;
  switch (panes) {
    case 1:
      cells = [{ x: 0, y: 0, width: w, height: h }];
      break;
    case 2:
      cells = [
        { x: 0, y: 0, width: halfW, height: h },
        { x: halfW, y: 0, width: halfW, height: h },
      ];
      break;
    case 3:
      cells = [
        { x: 0, y: 0, width: halfW, height: halfH },
        { x: halfW, y: 0, width: halfW, height: halfH },
        { x: 0, y: halfH, width: w, height: halfH },
      ];
      break;
    case 4:
    default:
      cells = [
        { x: 0, y: 0, width: halfW, height: halfH },
        { x: halfW, y: 0, width: halfW, height: halfH },
        { x: 0, y: halfH, width: halfW, height: halfH },
        { x: halfW, y: halfH, width: halfW, height: halfH },
      ];
      break;
  }

  return cells.map((cell, index) => ({
    index,
    x: cell.x + gap,
    y: cell.y + gap,
    width: Math.max(0, cell.width - gap * 2),
    height: Math.max(0, cell.height - gap * 2),
  }));
}
