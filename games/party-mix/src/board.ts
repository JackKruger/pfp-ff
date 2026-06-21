/**
 * The board is a closed loop of tiles laid out on a grid. Pawns walk the loop
 * one tile per step; landing on a tile resolves its effect. The layout is plain
 * data so it's easy to tune or swap out later.
 */

export type TileKind = "start" | "blue" | "red" | "star" | "event";

export interface Tile {
  /** Index in the loop (0-based, wraps). */
  index: number;
  /** Grid column / row, in tile units. */
  col: number;
  row: number;
  kind: TileKind;
}

export interface Board {
  tiles: Tile[];
  cols: number;
  rows: number;
}

/** Coin deltas for the simple economy tiles. */
export const TILE_COINS: Record<TileKind, number> = {
  start: 0,
  blue: 3,
  red: -3,
  star: 0,
  event: 0,
};

/**
 * Builds a rectangular ring of tiles. `cols`/`rows` are the bounding grid; the
 * ring walks the perimeter clockwise starting from the top-left (the START tile).
 */
export function createBoard(): Board {
  const cols = 9;
  const rows = 7;
  const perimeter: Array<{ col: number; row: number }> = [];

  // Top edge L→R, right edge T→B, bottom edge R→L, left edge B→T.
  for (let c = 0; c < cols; c++) perimeter.push({ col: c, row: 0 });
  for (let r = 1; r < rows; r++) perimeter.push({ col: cols - 1, row: r });
  for (let c = cols - 2; c >= 0; c--) perimeter.push({ col: c, row: rows - 1 });
  for (let r = rows - 2; r >= 1; r--) perimeter.push({ col: 0, row: r });

  // A repeating pattern of tile kinds around the loop, with the start tile at 0
  // and a couple of star/event tiles seeded for later phases.
  const pattern: TileKind[] = ["blue", "blue", "red", "blue", "event", "blue", "red", "star"];

  const tiles: Tile[] = perimeter.map((p, index) => ({
    index,
    col: p.col,
    row: p.row,
    kind: index === 0 ? "start" : pattern[index % pattern.length]!,
  }));

  return { tiles, cols, rows };
}

/** Steps `from` forward by `n` tiles around the loop, returning the new index. */
export function step(board: Board, from: number, n: number): number {
  return (from + n) % board.tiles.length;
}
