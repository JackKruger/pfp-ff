export const TILE_SIZE = 32;

export type BlockColor = "red" | "blue" | "yellow" | "green" | "gray";

export type TileKind =
  | "empty"
  | "dirt"
  | "stone"
  | "crate"
  | "redBlock"
  | "blueBlock"
  | "yellowBlock"
  | "greenBlock"
  | "grayBlock"
  | "steel"
  | "gem"
  | "boostie"
  | "dash"
  | "bomb"
  | "shield"
  | "stunBolt"
  | "burst"
  | "spikes"
  | "finish";

export type PickupKind = "gem" | "boostie" | "bomb" | "shield" | "stunBolt" | "burst";
export type HazardKind = "spikes";

export type TerrainCell =
  | { kind: "empty" }
  | { kind: "block"; color: BlockColor; variant?: "solid" | "crate"; contains?: PickupKind }
  | { kind: "steel" }
  | { kind: "pickup"; pickup: PickupKind }
  | { kind: "hazard"; hazard: HazardKind }
  | { kind: "finish" };

export type BlockCell = Extract<TerrainCell, { kind: "block" }>;

export interface DestroyTileResult {
  destroyed: boolean;
  replacement: TileKind;
  pickup?: PickupKind;
}

export interface DestroyedTileResult extends DestroyTileResult {
  tileX: number;
  tileY: number;
}

export interface CollectedPickup {
  kind: PickupKind;
  tileX: number;
  tileY: number;
}

export interface BlockDrop {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  kind: TileKind;
  cell: BlockCell;
}

export interface GrayChainExplosion {
  destroyed: DestroyedTileResult[];
  drops: BlockDrop[];
}

export function isSolidTile(kind: TileKind): boolean {
  return (
    kind === "dirt" ||
    kind === "stone" ||
    kind === "crate" ||
    kind === "redBlock" ||
    kind === "blueBlock" ||
    kind === "yellowBlock" ||
    kind === "greenBlock" ||
    kind === "grayBlock" ||
    kind === "steel"
  );
}

export function isBreakableTile(kind: TileKind): boolean {
  return (
    kind === "dirt" ||
    kind === "crate" ||
    kind === "redBlock" ||
    kind === "blueBlock" ||
    kind === "yellowBlock" ||
    kind === "greenBlock" ||
    kind === "grayBlock"
  );
}

export function isPickupTile(kind: TileKind): kind is PickupKind {
  return (
    kind === "gem" ||
    kind === "boostie" ||
    kind === "bomb" ||
    kind === "shield" ||
    kind === "stunBolt" ||
    kind === "burst"
  );
}

export class TerrainGrid {
  readonly width: number;
  readonly height: number;
  private readonly cells: TerrainCell[];

  constructor(width: number, height: number, fill: TileKind | TerrainCell = "empty") {
    if (width <= 0 || height <= 0) throw new Error("terrain dimensions must be positive");
    this.width = width;
    this.height = height;
    this.cells = Array.from({ length: width * height }, () => cloneCell(toCell(fill)));
  }

  clone(): TerrainGrid {
    const copy = new TerrainGrid(this.width, this.height);
    for (let i = 0; i < this.cells.length; i++) {
      copy.cells[i] = cloneCell(this.cells[i] ?? EMPTY_CELL);
    }
    return copy;
  }

  inBounds(tileX: number, tileY: number): boolean {
    return tileX >= 0 && tileY >= 0 && tileX < this.width && tileY < this.height;
  }

  get(tileX: number, tileY: number): TileKind {
    return toTileKind(this.getCell(tileX, tileY));
  }

  set(tileX: number, tileY: number, kind: TileKind | TerrainCell): void {
    if (!this.inBounds(tileX, tileY)) return;
    this.cells[this.index(tileX, tileY)] = cloneCell(toCell(kind));
  }

  getCell(tileX: number, tileY: number): TerrainCell {
    if (!this.inBounds(tileX, tileY)) return STEEL_CELL;
    return cloneCell(this.cells[this.index(tileX, tileY)] ?? EMPTY_CELL);
  }

  setCell(tileX: number, tileY: number, cell: TerrainCell): void {
    this.set(tileX, tileY, cell);
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
    const cell = this.getCell(tileX, tileY);
    return cell.kind === "block" || cell.kind === "steel";
  }

  isBreakable(tileX: number, tileY: number): boolean {
    return this.getCell(tileX, tileY).kind === "block";
  }

  destroyTile(tileX: number, tileY: number): DestroyTileResult {
    const cell = this.getCell(tileX, tileY);
    const kind = toTileKind(cell);
    if (cell.kind !== "block") return { destroyed: false, replacement: kind };

    const replacement = cell.contains ? pickupToCell(cell.contains) : EMPTY_CELL;
    this.setCell(tileX, tileY, replacement);
    return {
      destroyed: true,
      replacement: toTileKind(replacement),
      ...(cell.contains ? { pickup: cell.contains } : {}),
    };
  }

  destroyConnectedBlockGroup(tileX: number, tileY: number): DestroyedTileResult[] {
    const group = this.connectedBlockGroup(tileX, tileY);
    const destroyed: DestroyedTileResult[] = [];
    for (const tile of group) {
      const result = this.destroyTile(tile.tileX, tile.tileY);
      if (result.destroyed) destroyed.push({ ...result, tileX: tile.tileX, tileY: tile.tileY });
    }
    return destroyed;
  }

  connectedBlockGroup(tileX: number, tileY: number): { tileX: number; tileY: number }[] {
    const start = this.getCell(tileX, tileY);
    if (start.kind !== "block") return [];

    const group: { tileX: number; tileY: number }[] = [];
    const seen = new Set<string>();
    const pending = [{ tileX, tileY }];

    while (pending.length > 0) {
      const current = pending.pop()!;
      const key = `${current.tileX},${current.tileY}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const cell = this.getCell(current.tileX, current.tileY);
      if (cell.kind !== "block" || cell.color !== start.color) continue;

      group.push(current);
      pending.push(
        { tileX: current.tileX + 1, tileY: current.tileY },
        { tileX: current.tileX - 1, tileY: current.tileY },
        { tileX: current.tileX, tileY: current.tileY + 1 },
        { tileX: current.tileX, tileY: current.tileY - 1 },
      );
    }

    return group;
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

  settleBlockGravity(): BlockDrop[] {
    const drops: BlockDrop[] = [];
    for (let x = 0; x < this.width; x++) {
      for (let y = this.height - 2; y >= 0; y--) {
        const cell = this.cells[this.index(x, y)] ?? EMPTY_CELL;
        if (cell.kind !== "block") continue;

        let toY = y;
        while (toY + 1 < this.height && this.isEmptyCell(x, toY + 1)) toY++;
        if (toY === y) continue;

        this.cells[this.index(x, y)] = EMPTY_CELL;
        this.cells[this.index(x, toY)] = cell;
        drops.push({
          fromX: x,
          fromY: y,
          toX: x,
          toY,
          kind: toTileKind(cell),
          cell: cloneBlockCell(cell),
        });
      }
    }
    return drops;
  }

  resolveGrayChainExplosions(minGroupSize = 4): GrayChainExplosion[] {
    const explosions: GrayChainExplosion[] = [];

    while (true) {
      const groups = this.grayExplosionGroups(minGroupSize);
      if (groups.length === 0) return explosions;

      const destroyed: DestroyedTileResult[] = [];
      for (const group of groups) {
        for (const tile of group) {
          const result = this.destroyTile(tile.tileX, tile.tileY);
          if (result.destroyed) {
            destroyed.push({ ...result, tileX: tile.tileX, tileY: tile.tileY });
          }
        }
      }

      explosions.push({
        destroyed,
        drops: this.settleBlockGravity(),
      });
    }
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
        const cell = this.getCell(x, y);
        if (cell.kind !== "pickup") continue;
        collected.push({ kind: cell.pickup, tileX: x, tileY: y });
        this.setCell(x, y, EMPTY_CELL);
      }
    }
    return collected;
  }

  forEachTile(visitor: (tileX: number, tileY: number, kind: TileKind) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) visitor(x, y, this.get(x, y));
    }
  }

  forEachCell(visitor: (tileX: number, tileY: number, cell: TerrainCell) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) visitor(x, y, this.getCell(x, y));
    }
  }

  private index(tileX: number, tileY: number): number {
    return tileY * this.width + tileX;
  }

  private isEmptyCell(tileX: number, tileY: number): boolean {
    return (this.cells[this.index(tileX, tileY)] ?? EMPTY_CELL).kind === "empty";
  }

  private grayExplosionGroups(minGroupSize: number): { tileX: number; tileY: number }[][] {
    const groups: { tileX: number; tileY: number }[][] = [];
    const seen = new Set<string>();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const key = `${x},${y}`;
        if (seen.has(key)) continue;

        const cell = this.getCell(x, y);
        if (cell.kind !== "block" || cell.color !== "gray") continue;

        const group = this.connectedBlockGroup(x, y);
        for (const tile of group) seen.add(`${tile.tileX},${tile.tileY}`);
        if (group.length >= minGroupSize) groups.push(group);
      }
    }

    return groups;
  }
}

const EMPTY_CELL: TerrainCell = { kind: "empty" };
const STEEL_CELL: TerrainCell = { kind: "steel" };

function cloneCell(cell: TerrainCell): TerrainCell {
  return { ...cell };
}

function pickupToCell(pickup: PickupKind): TerrainCell {
  return { kind: "pickup", pickup };
}

function cloneBlockCell(cell: BlockCell): BlockCell {
  return { ...cell };
}

function toCell(kindOrCell: TileKind | TerrainCell): TerrainCell {
  if (typeof kindOrCell !== "string") return kindOrCell;
  switch (kindOrCell) {
    case "empty":
      return EMPTY_CELL;
    case "dirt":
      return { kind: "block", color: "yellow" };
    case "crate":
      return { kind: "block", color: "red", variant: "crate", contains: "gem" };
    case "redBlock":
      return { kind: "block", color: "red" };
    case "blueBlock":
      return { kind: "block", color: "blue" };
    case "yellowBlock":
      return { kind: "block", color: "yellow" };
    case "greenBlock":
      return { kind: "block", color: "green" };
    case "grayBlock":
      return { kind: "block", color: "gray" };
    case "stone":
    case "steel":
      return STEEL_CELL;
    case "gem":
    case "boostie":
    case "dash":
    case "bomb":
    case "shield":
    case "stunBolt":
    case "burst":
      return pickupToCell(kindOrCell === "dash" ? "boostie" : kindOrCell);
    case "spikes":
      return { kind: "hazard", hazard: "spikes" };
    case "finish":
      return { kind: "finish" };
  }
}

function toTileKind(cell: TerrainCell): TileKind {
  switch (cell.kind) {
    case "empty":
      return "empty";
    case "block":
      if (cell.variant === "crate") return "crate";
      if (cell.color === "red") return "redBlock";
      if (cell.color === "blue") return "blueBlock";
      if (cell.color === "green") return "greenBlock";
      if (cell.color === "gray") return "grayBlock";
      return "yellowBlock";
    case "steel":
      return "stone";
    case "pickup":
      return cell.pickup;
    case "hazard":
      return cell.hazard;
    case "finish":
      return "finish";
  }
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
