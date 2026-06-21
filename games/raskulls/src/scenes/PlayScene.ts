import Phaser from "phaser";
import type { PlayerSlot } from "@pfp/sdk";
import { TEXTURES } from "../assets.js";
import { session } from "../session.js";
import {
  TILE_SIZE,
  TerrainGrid,
  type PickupKind,
  type Rect,
  type TileKind,
} from "../systems/terrain.js";
import type { PlayerActions } from "../systems/input.js";
import type { PlayerStats, RankedPlayer, RaskullsMode, Vec2 } from "../systems/types.js";

const PLAYER_WIDTH = 26;
const PLAYER_HEIGHT = 34;
const RUN_SPEED = 220;
const JUMP_SPEED = 500;
const GRAVITY = 1450;
const MAX_FALL_SPEED = 720;
const DIG_COOLDOWN_MS = 180;

interface LevelSetup {
  grid: TerrainGrid;
  starts: Vec2[];
  lives: number;
}

export interface PlayPlayer extends PlayerSlot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: -1 | 1;
  onGround: boolean;
  alive: boolean;
  finished: boolean;
  lives: number;
  respawnAt: number;
  stunnedUntil: number;
  dashUntil: number;
  shieldUntil: number;
  digReadyAt: number;
  lastHitBy: number | null;
  powerup: Exclude<PickupKind, "gem"> | null;
  stats: PlayerStats;
  view: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  shieldView: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  powerText: Phaser.GameObjects.Text;
}

export abstract class PlayScene extends Phaser.Scene {
  protected readonly mode: RaskullsMode;
  protected grid!: TerrainGrid;
  protected starts: Vec2[] = [];
  protected players: PlayPlayer[] = [];
  protected elapsedMs = 0;

  private tileSprites = new Map<string, Phaser.GameObjects.Image>();
  private hud?: Phaser.GameObjects.Text;
  private pauseLayer?: Phaser.GameObjects.Container;
  private levelStartedAt = 0;
  private wallStartedAt = 0;
  private ended = false;
  private paused = false;

  protected constructor(key: string, mode: RaskullsMode) {
    super(key);
    this.mode = mode;
  }

  protected beginLevel(setup: LevelSetup): void {
    const context = session.context;
    if (!context) {
      session.client.requestExit();
      return;
    }

    this.grid = setup.grid;
    this.starts = setup.starts;
    this.players = context.players.map((player) => this.createPlayer(player, setup.lives));
    this.levelStartedAt = this.time.now;
    this.wallStartedAt = Date.now();
    this.ended = false;
    this.paused = false;

    this.cameras.main.setBounds(0, 0, this.grid.width * TILE_SIZE, this.grid.height * TILE_SIZE);
    this.cameras.main.setBackgroundColor(this.mode === "race" ? 0x172033 : 0x151826);
    this.renderTerrain();
    this.hud = this.add.text(18, 16, "", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "16px",
      color: "#f8fafc",
      backgroundColor: "rgba(15, 23, 42, 0.62)",
      padding: { x: 10, y: 8 },
    });
    this.hud.setScrollFactor(0);
    this.hud.setDepth(50);
  }

  protected updatePlay(time: number, delta: number): void {
    if (this.ended || !this.grid) return;

    const context = session.context;
    if (!context) return;

    const dt = Math.min(delta / 1000, 0.034);
    this.elapsedMs = Math.max(0, time - this.levelStartedAt);
    session.input.tick();

    const actionBySlot = new Map<number, PlayerActions>();
    for (const player of this.players)
      actionBySlot.set(player.slot, session.input.actionsFor(player));

    if (this.paused) {
      this.updatePaused(actionBySlot);
      session.input.commit();
      return;
    }

    if (this.anyAction(actionBySlot, (action) => action.justStart)) {
      this.setPaused(true);
      session.input.commit();
      return;
    }

    for (const player of this.players) {
      this.updatePlayer(player, actionBySlot.get(player.slot)!, time, dt);
    }

    this.resolvePlayerHits(time);
    for (const player of this.players) this.updatePlayerView(player, time);
    this.updateCamera();
    this.updateHud();
    session.input.commit();
  }

  protected completeMatch(ranked: RankedPlayer[]): void {
    if (this.ended) return;
    this.ended = true;
    session.completed = {
      mode: this.mode,
      startedAt: this.wallStartedAt,
      endedAt: Date.now(),
      ranked,
    };
    this.scene.start("ResultsScene");
  }

  protected abstract hudText(): string;

  private createPlayer(slot: PlayerSlot, lives: number): PlayPlayer {
    const start = this.starts[slot.slot] ?? this.starts[0] ?? { x: 64, y: 64 };
    const body = this.add.image(0, 0, TEXTURES.player);
    body.setTint(Phaser.Display.Color.HexStringToColor(slot.color).color);
    const shieldView = this.add.ellipse(0, 0, 40, 46);
    shieldView.setStrokeStyle(3, 0x7dd3fc, 0.85);
    shieldView.setVisible(false);
    const label = this.add.text(0, -34, slot.displayName, {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "12px",
      fontStyle: "700",
      color: "#f8fafc",
      stroke: "#111827",
      strokeThickness: 3,
    });
    label.setOrigin(0.5);
    const powerText = this.add.text(0, 30, "", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "11px",
      fontStyle: "700",
      color: "#fde68a",
      stroke: "#111827",
      strokeThickness: 3,
    });
    powerText.setOrigin(0.5);

    const view = this.add.container(start.x, start.y, [shieldView, body, label, powerText]);
    view.setDepth(20);

    return {
      ...slot,
      x: start.x - PLAYER_WIDTH / 2,
      y: start.y - PLAYER_HEIGHT,
      vx: 0,
      vy: 0,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      facing: 1,
      onGround: false,
      alive: true,
      finished: false,
      lives,
      respawnAt: 0,
      stunnedUntil: 0,
      dashUntil: 0,
      shieldUntil: 0,
      digReadyAt: 0,
      lastHitBy: null,
      powerup: null,
      stats: {
        blocksBroken: 0,
        gems: 0,
        eliminations: 0,
        deaths: 0,
      },
      view,
      body,
      shieldView,
      label,
      powerText,
    };
  }

  private updatePlayer(player: PlayPlayer, actions: PlayerActions, time: number, dt: number): void {
    if (player.finished) return;

    if (!player.alive) {
      if (player.lives > 0 && time >= player.respawnAt) this.respawnPlayer(player);
      return;
    }

    const stunned = time < player.stunnedUntil;
    if (!stunned) {
      if (Math.abs(actions.moveX) > 0.15) player.facing = actions.moveX < 0 ? -1 : 1;
      player.vx = actions.moveX * RUN_SPEED;
      if (actions.justJump && player.onGround) {
        player.vy = -JUMP_SPEED;
        player.onGround = false;
      }
      if (actions.justDig && time >= player.digReadyAt) this.dig(player, actions);
      if (actions.justPower) this.usePower(player, time);
    } else {
      player.vx *= 0.95;
    }

    player.vy = Math.min(MAX_FALL_SPEED, player.vy + GRAVITY * dt);
    this.movePlayer(player, player.vx * dt, 0);
    this.movePlayer(player, 0, player.vy * dt);
    this.collectPickups(player);

    if (
      this.touchesTile(playerRect(player), "spikes") ||
      player.y > this.grid.height * TILE_SIZE + 96
    ) {
      this.killPlayer(player, player.lastHitBy, time);
    }
  }

  private dig(player: PlayPlayer, actions: PlayerActions): void {
    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;
    let targetX = centerX + player.facing * (player.width / 2 + TILE_SIZE / 2);
    let targetY = centerY;
    if (actions.moveY > 0.45) {
      targetX = centerX;
      targetY = player.y + player.height + TILE_SIZE / 2;
    } else if (actions.moveY < -0.45) {
      targetX = centerX;
      targetY = player.y - TILE_SIZE / 2;
    }

    const { tileX, tileY } = this.grid.worldToTile(targetX, targetY);
    const result = this.grid.destroyTile(tileX, tileY);
    if (!result.destroyed) return;
    player.stats.blocksBroken += 1;
    player.digReadyAt = this.time.now + DIG_COOLDOWN_MS;
    this.redrawTile(tileX, tileY);
    this.addBreakFlash(tileX, tileY);
  }

  private usePower(player: PlayPlayer, time: number): void {
    if (player.powerup === "dash") {
      player.vx = player.facing * 620;
      player.dashUntil = time + 340;
      player.powerup = null;
    } else if (player.powerup === "bomb") {
      this.bomb(player);
      player.powerup = null;
    } else if (player.powerup === "shield") {
      player.shieldUntil = time + 5_000;
      player.powerup = null;
    }
  }

  private bomb(player: PlayPlayer): void {
    const frontX = player.x + player.width / 2 + player.facing * TILE_SIZE;
    const frontY = player.y + player.height / 2;
    const center = this.grid.worldToTile(frontX, frontY);
    for (let y = center.tileY - 1; y <= center.tileY + 1; y++) {
      for (let x = center.tileX - 1; x <= center.tileX + 1; x++) {
        const result = this.grid.destroyTile(x, y);
        if (!result.destroyed) continue;
        player.stats.blocksBroken += 1;
        this.redrawTile(x, y);
        this.addBreakFlash(x, y);
      }
    }
  }

  private movePlayer(player: PlayPlayer, dx: number, dy: number): void {
    if (dx !== 0) {
      player.x += dx;
      if (this.grid.rectCollidesSolid(playerRect(player))) {
        if (dx > 0) {
          const rightTile = Math.floor((player.x + player.width - 1) / TILE_SIZE);
          player.x = rightTile * TILE_SIZE - player.width;
        } else {
          const leftTile = Math.floor(player.x / TILE_SIZE);
          player.x = (leftTile + 1) * TILE_SIZE;
        }
        player.vx = 0;
      }
    }

    if (dy !== 0) {
      player.y += dy;
      player.onGround = false;
      if (this.grid.rectCollidesSolid(playerRect(player))) {
        if (dy > 0) {
          const bottomTile = Math.floor((player.y + player.height - 1) / TILE_SIZE);
          player.y = bottomTile * TILE_SIZE - player.height;
          player.onGround = true;
        } else {
          const topTile = Math.floor(player.y / TILE_SIZE);
          player.y = (topTile + 1) * TILE_SIZE;
        }
        player.vy = 0;
      }
    }
  }

  private collectPickups(player: PlayPlayer): void {
    const pickups = this.grid.collectPickups(playerRect(player));
    for (const pickup of pickups) {
      this.redrawTile(pickup.tileX, pickup.tileY);
      if (pickup.kind === "gem") {
        player.stats.gems += 1;
      } else {
        player.powerup = pickup.kind;
      }
    }
  }

  private killPlayer(player: PlayPlayer, causeSlot: number | null, time: number): void {
    if (!player.alive) return;
    player.stats.deaths += 1;
    if (causeSlot !== null && causeSlot !== player.slot) {
      const killer = this.players.find((candidate) => candidate.slot === causeSlot);
      if (killer) killer.stats.eliminations += 1;
    }
    player.alive = false;
    player.vx = 0;
    player.vy = 0;
    player.lastHitBy = null;
    if (this.mode === "arena") player.lives = Math.max(0, player.lives - 1);
    player.respawnAt = time + (this.mode === "race" ? 750 : 1100);
    player.view.setAlpha(player.lives > 0 ? 0.32 : 0.12);
  }

  private respawnPlayer(player: PlayPlayer): void {
    const start = this.starts[player.slot] ?? this.starts[0] ?? { x: 64, y: 64 };
    player.x = start.x - player.width / 2;
    player.y = start.y - player.height;
    player.vx = 0;
    player.vy = 0;
    player.alive = true;
    player.onGround = false;
    player.stunnedUntil = this.time.now + 350;
    player.view.setAlpha(1);
  }

  private resolvePlayerHits(time: number): void {
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i]!;
        const b = this.players[j]!;
        if (!a.alive || !b.alive || a.finished || b.finished) continue;
        if (!rectsOverlap(playerRect(a), playerRect(b))) continue;
        this.resolveHit(a, b, time);
        this.resolveHit(b, a, time);
      }
    }
  }

  private resolveHit(attacker: PlayPlayer, victim: PlayPlayer, time: number): void {
    const attackerDashing = time < attacker.dashUntil;
    if (!attackerDashing || time < victim.shieldUntil) {
      const direction = attacker.x < victim.x ? -1 : 1;
      attacker.vx = direction * 90;
      victim.vx = -direction * 90;
      return;
    }

    victim.lastHitBy = attacker.slot;
    victim.stunnedUntil = time + 650;
    victim.vx = attacker.facing * 360;
    victim.vy = -260;
  }

  private renderTerrain(): void {
    this.tileSprites.clear();
    this.grid.forEachTile((tileX, tileY) => this.redrawTile(tileX, tileY));
  }

  private redrawTile(tileX: number, tileY: number): void {
    const key = `${tileX},${tileY}`;
    this.tileSprites.get(key)?.destroy();
    this.tileSprites.delete(key);

    const texture = textureForTile(this.grid.get(tileX, tileY));
    if (!texture) return;
    const { x, y } = this.grid.tileToWorldCenter(tileX, tileY);
    const sprite = this.add.image(x, y, texture);
    sprite.setDepth(texture === TEXTURES.finish ? 2 : 1);
    if (texture === TEXTURES.finish) sprite.setAlpha(0.8);
    this.tileSprites.set(key, sprite);
  }

  private addBreakFlash(tileX: number, tileY: number): void {
    const { x, y } = this.grid.tileToWorldCenter(tileX, tileY);
    const flash = this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, 0xfde68a, 0.5);
    flash.setDepth(30);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.35,
      duration: 160,
      onComplete: () => flash.destroy(),
    });
  }

  private touchesTile(rect: Rect, tile: TileKind): boolean {
    const bounds = this.grid.rectTileBounds(rect);
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        if (this.grid.get(x, y) === tile) return true;
      }
    }
    return false;
  }

  private updatePlayerView(player: PlayPlayer, time: number): void {
    player.view.setPosition(player.x + player.width / 2, player.y + player.height / 2);
    player.body.setFlipX(player.facing < 0);
    player.body.setScale(time < player.dashUntil ? 1.12 : 1);
    player.shieldView.setVisible(time < player.shieldUntil);
    player.powerText.setText(player.powerup ? player.powerup.toUpperCase() : "");
    player.label.setText(player.lives > 0 ? player.displayName : `${player.displayName} OUT`);
  }

  private updateCamera(): void {
    const active = this.players.filter((player) => player.alive && !player.finished);
    const targets = active.length > 0 ? active : this.players;
    const centers = targets.map((player) => ({
      x: player.x + player.width / 2,
      y: player.y + player.height / 2,
    }));
    const minX = Math.min(...centers.map((point) => point.x));
    const maxX = Math.max(...centers.map((point) => point.x));
    const minY = Math.min(...centers.map((point) => point.y));
    const maxY = Math.max(...centers.map((point) => point.y));
    const spanX = Math.max(420, maxX - minX + 260);
    const spanY = Math.max(260, maxY - minY + 190);
    const zoom = Phaser.Math.Clamp(
      Math.min(this.scale.width / spanX, this.scale.height / spanY),
      this.mode === "race" ? 0.55 : 0.72,
      1.25,
    );
    const camera = this.cameras.main;
    camera.zoom = Phaser.Math.Linear(camera.zoom, zoom, 0.08);
    camera.centerOn((minX + maxX) / 2, (minY + maxY) / 2);
  }

  private updateHud(): void {
    this.hud?.setText(this.hudText());
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      const shade = this.add.rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0x020617,
        0.72,
      );
      const title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 42, "Paused", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "38px",
        fontStyle: "800",
        color: "#f8fafc",
      });
      title.setOrigin(0.5);
      const options = this.add.text(
        this.scale.width / 2,
        this.scale.height / 2 + 18,
        "Resume   Quit",
        {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "20px",
          color: "#cbd5e1",
        },
      );
      options.setOrigin(0.5);
      this.pauseLayer = this.add.container(0, 0, [shade, title, options]);
      this.pauseLayer.setScrollFactor(0);
      this.pauseLayer.setDepth(100);
    } else {
      this.pauseLayer?.destroy(true);
      this.pauseLayer = undefined;
    }
  }

  private updatePaused(actions: Map<number, PlayerActions>): void {
    if (this.anyAction(actions, (action) => action.justBack || action.justDig)) {
      session.client.requestExit();
    } else if (this.anyAction(actions, (action) => action.justStart || action.justJump)) {
      this.setPaused(false);
    }
  }

  private anyAction(
    actions: Map<number, PlayerActions>,
    predicate: (action: PlayerActions) => boolean,
  ): boolean {
    for (const action of actions.values()) {
      if (predicate(action)) return true;
    }
    return false;
  }
}

function textureForTile(kind: TileKind): string | null {
  switch (kind) {
    case "dirt":
      return TEXTURES.dirt;
    case "stone":
      return TEXTURES.stone;
    case "crate":
      return TEXTURES.crate;
    case "gem":
      return TEXTURES.gem;
    case "dash":
      return TEXTURES.dash;
    case "bomb":
      return TEXTURES.bomb;
    case "shield":
      return TEXTURES.shield;
    case "spikes":
      return TEXTURES.spikes;
    case "finish":
      return TEXTURES.finish;
    case "empty":
      return null;
  }
}

function playerRect(player: PlayPlayer): Rect {
  return {
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height,
  };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
