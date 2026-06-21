export const TILE_SIZE = 32;

export type TileKind =
  | "empty"
  | "dirt"
  | "stone"
  | "crate"
  | "gem"
  | "dash"
  | "bomb"
  | "shield"
  | "spikes"
  | "finish";

export type PickupKind = "gem" | "dash" | "bomb" | "shield";

export interface DestroyTileResult {
  destroyed: boolean;
  replacement: TileKind;
  pickup?: PickupKind;
}

export interface CollectedPickup {
  kind: PickupKind;
  tileX: number;
  tileY: number;
}

export function isSolidTile(kind: TileKind): boolean {
  return kind === "dirt" || kind === "stone" || kind === "crate";
}

export function isBreakableTile(kind: TileKind): boolean {
  return kind === "dirt" || kind === "crate";
}

export function isPickupTile(kind: TileKind): kind is PickupKind {
  return kind === "gem" || kind === "dash" || kind === "bomb" || kind === "shield";
}

export class TerrainGrid {
  readonly width: number;
  readonly height: number;
  private readonly tiles: TileKind[];

  constructor(width: number, height: number, fill: TileKind = "empty") {
    if (width <= 0 || height <= 0) throw new Error("terrain dimensions must be positive");
    this.width = width;
    this.height = height;
    this.tiles = Array.from({ length: width * height }, () => fill);
  }

  clone(): TerrainGrid {
    const copy = new TerrainGrid(this.width, this.height);
    for (let i = 0; i < this.tiles.length; i++) copy.tiles[i] = this.tiles[i] ?? "empty";
    return copy;
  }

  inBounds(tileX: number, tileY: number): boolean {
    return tileX >= 0 && tileY >= 0 && tileX < this.width && tileY < this.height;
  }

  get(tileX: number, tileY: number): TileKind {
    if (!this.inBounds(tileX, tileY)) return "stone";
    return this.tiles[this.index(tileX, tileY)] ?? "empty";
  }

  set(tileX: number, tileY: number, kind: TileKind): void {
    if (!this.inBounds(tileX, tileY)) return;
    this.tiles[this.index(tileX, tileY)] = kind;
  }

  worldToTile(worldX: number, worldY: number): { tileX: number; tileY: number } {
    return {
      tileX: Math.floor(worldX / TILE_SIZE),
      tileY: Math.floor(worldY / TILE_SIZE),
    };
  }

  tileToWorldCenter(tileX: number, tileY: number): { x: number; y: number } {
    return {
      x: tileX * TILE_SIZE + TILE_SIZE / 2,
      y: tileY * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  isSolid(tileX: number, tileY: number): boolean {
    return isSolidTile(this.get(tileX, tileY));
  }

  isBreakable(tileX: number, tileY: number): boolean {
    return isBreakableTile(this.get(tileX, tileY));
  }

  destroyTile(tileX: number, tileY: number): DestroyTileResult {
    const kind = this.get(tileX, tileY);
    if (!isBreakableTile(kind)) return { destroyed: false, replacement: kind };

    const replacement: TileKind = kind === "crate" ? "gem" : "empty";
    this.set(tileX, tileY, replacement);
    return {
      destroyed: true,
      replacement,
      ...(replacement === "gem" ? { pickup: "gem" } : {}),
    };
  }

  destroyArea(centerTileX: number, centerTileY: number, radius: number): DestroyTileResult[] {
    const destroyed: DestroyTileResult[] = [];
    for (let y = centerTileY - radius; y <= centerTileY + radius; y++) {
      for (let x = centerTileX - radius; x <= centerTileX + radius; x++) {
        const result = this.destroyTile(x, y);
        if (result.destroyed) destroyed.push(result);
      }
    }
    return destroyed;
  }

  rectTileBounds(rect: Rect): { minX: number; maxX: number; minY: number; maxY: number } {
    return {
      minX: Math.floor(rect.x / TILE_SIZE),
      maxX: Math.floor((rect.x + rect.width - 1) / TILE_SIZE),
      minY: Math.floor(rect.y / TILE_SIZE),
      maxY: Math.floor((rect.y + rect.height - 1) / TILE_SIZE),
    };
  }

  rectCollidesSolid(rect: Rect): boolean {
    const bounds = this.rectTileBounds(rect);
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        if (this.isSolid(x, y)) return true;
      }
    }
    return false;
  }

  collectPickups(rect: Rect): CollectedPickup[] {
    const collected: CollectedPickup[] = [];
    const bounds = this.rectTileBounds(rect);
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const kind = this.get(x, y);
        if (!isPickupTile(kind)) continue;
        collected.push({ kind, tileX: x, tileY: y });
        this.set(x, y, "empty");
      }
    }
    return collected;
  }

  forEachTile(visitor: (tileX: number, tileY: number, kind: TileKind) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) visitor(x, y, this.get(x, y));
    }
  }

  private index(tileX: number, tileY: number): number {
    return tileY * this.width + tileX;
  }
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
