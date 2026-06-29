import Phaser from "phaser";
import type { PlayerSlot } from "@pfp/sdk";
import { TEXTURES, textureKeyForVariant, variantForSlot } from "../assets.js";
import { session } from "../session.js";
import { chooseRaceBotActions } from "../systems/bot.js";
import { hazardEffectForMode } from "../systems/hazards.js";
import {
  TILE_SIZE,
  TerrainGrid,
  type BlockDrop,
  type GrayChainExplosion,
  type PickupKind,
  type Rect,
  type TileKind,
} from "../systems/terrain.js";
import type { PlayerActions } from "../systems/input.js";
import type { PlayerStats, RankedPlayer, RaskullsMode, Vec2 } from "../systems/types.js";

const PLAYER_WIDTH = 26;
const PLAYER_HEIGHT = 34;
const FRENZY_MAX_ENERGY = 100;
const FRENZY_BOOSTIE_ENERGY = 35;
const FRENZY_MIN_ACTIVATE = 30;
const STUN_BOLT_RANGE = 320;
const STUN_BOLT_LANE_HEIGHT = 92;
const STUN_BOLT_STUN_MS = 700;
const STUN_BOLT_FRENZY_DRAIN = 24;
const BURST_RADIUS_TILES = 1;

interface ModeTuning {
  runSpeed: number;
  frenzyRunMultiplier: number;
  jumpSpeed: number;
  gravity: number;
  maxFallSpeed: number;
  wandCooldownMs: number;
  frenzyDrainRate: number;
  respawnStunMs: number;
  frenzyHitStunMs: number;
  overlapKnockbackX: number;
  frenzyHitKnockbackX: number;
  frenzyHitKnockbackY: number;
}

const MODE_TUNING: Record<RaskullsMode, ModeTuning> = {
  race: {
    runSpeed: 250,
    frenzyRunMultiplier: 1.34,
    jumpSpeed: 500,
    gravity: 1420,
    maxFallSpeed: 740,
    wandCooldownMs: 160,
    frenzyDrainRate: 34,
    respawnStunMs: 260,
    frenzyHitStunMs: 360,
    overlapKnockbackX: 55,
    frenzyHitKnockbackX: 240,
    frenzyHitKnockbackY: 170,
  },
  arena: {
    runSpeed: 220,
    frenzyRunMultiplier: 1.28,
    jumpSpeed: 500,
    gravity: 1450,
    maxFallSpeed: 720,
    wandCooldownMs: 180,
    frenzyDrainRate: 40,
    respawnStunMs: 350,
    frenzyHitStunMs: 650,
    overlapKnockbackX: 90,
    frenzyHitKnockbackX: 360,
    frenzyHitKnockbackY: 260,
  },
};

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
  frenzyEnergy: number;
  frenzyActive: boolean;
  frenzyDrainRate: number;
  frenzyTrailAt: number;
  hazardReadyAt: number;
  shieldUntil: number;
  digReadyAt: number;
  lastHitBy: number | null;
  powerup: Exclude<PickupKind, "gem" | "boostie"> | null;
  bot: boolean;
  stats: PlayerStats;
  view: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  shieldView: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  powerIcon: Phaser.GameObjects.Image;
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
  private preRaceOverlay?: Phaser.GameObjects.Container;
  protected preRaceActive = false;

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
    const fillRaceBots = context.settings.raceBots !== false;
    const playerSlots =
      this.mode === "race" && fillRaceBots ? withRaceBots(context.players) : context.players;
    this.players = playerSlots.map((player) => this.createPlayer(player, setup.lives));
    this.levelStartedAt = this.time.now;
    this.wallStartedAt = Date.now();
    this.ended = false;
    this.paused = false;

    this.cameras.main.setBounds(0, 0, this.grid.width * TILE_SIZE, this.grid.height * TILE_SIZE);
    this.cameras.main.setBackgroundColor(this.mode === "race" ? 0x172033 : 0x151826);
    // Seed camera position to the first start so first frame isn't a long lerp from 0,0
    const firstStart = setup.starts[0] ?? { x: 64, y: 64 };
    this.cameraTargetX = firstStart.x;
    this.cameraTargetY = firstStart.y;
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

    session.input.tick();

    // Pre-race overlay: pause gameplay, allow any button to skip
    if (this.preRaceActive) {
      const anyPressed = context.players.some((player) => {
        const action = session.input.actionsFor(player);
        return action.justJump || action.justDig || action.justPower || action.justStart;
      });
      if (anyPressed) this.dismissPreRaceOverlay();
      session.input.commit();
      return;
    }

    const dt = Math.min(delta / 1000, 0.034);
    this.elapsedMs = Math.max(0, time - this.levelStartedAt);

    const actionBySlot = new Map<number, PlayerActions>();
    for (const player of this.players) {
      actionBySlot.set(
        player.slot,
        player.bot ? this.botActionsFor(player) : session.input.actionsFor(player),
      );
    }

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

  protected completeMatch(
    ranked: RankedPlayer[],
    options: { levelName?: string; grandPrixFinal?: boolean } = {},
  ): void {
    if (this.ended) return;
    this.ended = true;
    session.completed = {
      mode: this.mode,
      ...options,
      startedAt: this.wallStartedAt,
      endedAt: Date.now(),
      ranked,
    };
    this.scene.start("ResultsScene");
  }

  protected abstract hudText(): string;

  protected showPreRaceOverlay(levelName: string, flavorText: string): void {
    this.preRaceActive = true;
    const w = this.scale.width;
    const h = this.scale.height;
    const shade = this.add.rectangle(w / 2, h / 2, w, h, 0x020617, 0.78);
    shade.setScrollFactor(0);
    const title = this.add.text(w / 2, h / 2 - 56, levelName, {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "52px",
      fontStyle: "800",
      color: "#facc15",
      stroke: "#111827",
      strokeThickness: 4,
    });
    title.setOrigin(0.5);
    title.setScrollFactor(0);
    const flavor = this.add.text(w / 2, h / 2 + 10, flavorText, {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "20px",
      color: "#e2e8f0",
      stroke: "#111827",
      strokeThickness: 3,
    });
    flavor.setOrigin(0.5);
    flavor.setScrollFactor(0);
    const skip = this.add.text(w / 2, h / 2 + 68, "Press any button to start", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "15px",
      color: "#9ca3af",
    });
    skip.setOrigin(0.5);
    skip.setScrollFactor(0);
    this.preRaceOverlay = this.add.container(0, 0, [shade, title, flavor, skip]);
    this.preRaceOverlay.setDepth(80);
    // Auto-dismiss after 1.5 seconds
    this.time.delayedCall(1500, () => this.dismissPreRaceOverlay());
  }

  protected dismissPreRaceOverlay(): void {
    if (!this.preRaceActive) return;
    this.preRaceActive = false;
    this.preRaceOverlay?.destroy(true);
    this.preRaceOverlay = undefined;
    this.levelStartedAt = this.time.now;
    this.wallStartedAt = Date.now();
  }

  protected canDig(_player: PlayPlayer): boolean {
    return true;
  }

  protected onSuccessfulDig(_player: PlayPlayer, _destroyedCount: number): void {}

  protected onPickupCollected(_player: PlayPlayer, _pickup: PickupKind): void {}

  private get tuning(): ModeTuning {
    return MODE_TUNING[this.mode];
  }

  private createPlayer(slot: PlayerSlot, lives: number): PlayPlayer {
    const start = this.starts[slot.slot] ?? this.starts[0] ?? { x: 64, y: 64 };
    const variant = variantForSlot(slot.slot);
    const playerTexture = textureKeyForVariant(variant);
    const body = this.add.image(0, 0, playerTexture);
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
    const powerIcon = this.add.image(0, 31, TEXTURES.bomb);
    powerIcon.setScale(0.72);
    powerIcon.setVisible(false);

    const view = this.add.container(start.x, start.y, [shieldView, body, label, powerIcon]);
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
      frenzyEnergy: 0,
      frenzyActive: false,
      frenzyDrainRate: this.tuning.frenzyDrainRate,
      frenzyTrailAt: 0,
      hazardReadyAt: 0,
      shieldUntil: 0,
      digReadyAt: 0,
      lastHitBy: null,
      powerup: null,
      bot: isBotSlot(slot),
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
      powerIcon,
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
      const runSpeed =
        this.tuning.runSpeed * (player.frenzyActive ? this.tuning.frenzyRunMultiplier : 1);
      player.vx = actions.moveX * runSpeed;
      if (actions.justJump && player.onGround) {
        player.vy = -this.tuning.jumpSpeed;
        player.onGround = false;
      }
      if (actions.justDig && time >= player.digReadyAt) this.dig(player, actions);
      if (actions.justPower) this.usePower(player, time);
    } else {
      player.vx *= 0.95;
    }

    this.updateFrenzy(player, dt, time);
    player.vy = Math.min(this.tuning.maxFallSpeed, player.vy + this.tuning.gravity * dt);
    this.movePlayer(player, player.vx * dt, 0);
    this.movePlayer(player, 0, player.vy * dt);
    this.collectPickups(player);

    if (this.touchesTile(playerRect(player), "spikes")) {
      this.applyHazard(player, time);
    }

    if (player.y > this.grid.height * TILE_SIZE + 96) {
      this.killPlayer(player, player.lastHitBy, time);
    }
  }

  private applyHazard(player: PlayPlayer, time: number): void {
    if (time < player.hazardReadyAt) return;

    const effect = hazardEffectForMode(this.mode);
    if (effect.lethal) {
      this.killPlayer(player, player.lastHitBy, time);
      return;
    }

    player.vx *= effect.speedMultiplier;
    player.vy = -effect.bounceY;
    player.stunnedUntil = Math.max(player.stunnedUntil, time + effect.stunMs);
    player.frenzyEnergy = Math.max(0, player.frenzyEnergy - effect.frenzyDrain);
    if (player.frenzyEnergy <= 0) player.frenzyActive = false;
    if (effect.clearPowerup) player.powerup = null;
    player.hazardReadyAt = time + 700;
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
    if (!this.canDig(player)) {
      this.addFailedHitFlash(tileX, tileY);
      player.digReadyAt = this.time.now + this.tuning.wandCooldownMs;
      return;
    }

    const destroyed = this.grid.destroyConnectedBlockGroup(tileX, tileY);
    if (destroyed.length === 0) {
      this.addFailedHitFlash(tileX, tileY);
      player.digReadyAt = this.time.now + this.tuning.wandCooldownMs;
      return;
    }
    player.stats.blocksBroken += destroyed.length;
    player.digReadyAt = this.time.now + this.tuning.wandCooldownMs;
    for (const tile of destroyed) {
      this.redrawTile(tile.tileX, tile.tileY);
      this.addBreakFlash(tile.tileX, tile.tileY);
    }
    this.onSuccessfulDig(player, destroyed.length);
    this.settleBlocksAndResolveChains();
  }

  private usePower(player: PlayPlayer, time: number): void {
    if (!player.powerup && player.frenzyEnergy >= FRENZY_MIN_ACTIVATE) {
      player.frenzyActive = true;
      player.frenzyTrailAt = time;
    } else if (player.powerup === "bomb") {
      this.bomb(player);
      player.powerup = null;
    } else if (player.powerup === "shield") {
      player.shieldUntil = time + 5_000;
      player.powerup = null;
    } else if (player.powerup === "stunBolt") {
      this.stunBolt(player, time);
      player.powerup = null;
    } else if (player.powerup === "burst") {
      this.blockClearBurst(player);
      player.powerup = null;
    }
  }

  private botActionsFor(player: PlayPlayer): PlayerActions {
    const frontX = player.x + player.width / 2 + player.facing * TILE_SIZE;
    const head = this.grid.worldToTile(frontX, player.y + player.height * 0.35);
    const feet = this.grid.worldToTile(frontX, player.y + player.height * 0.82);
    return chooseRaceBotActions({
      blockedAhead:
        this.grid.isSolid(head.tileX, head.tileY) || this.grid.isSolid(feet.tileX, feet.tileY),
      onGround: player.onGround,
      frenzyEnergy: player.frenzyEnergy,
      hasPowerup: player.powerup !== null,
    });
  }

  private updateFrenzy(player: PlayPlayer, dt: number, time: number): void {
    if (!player.frenzyActive) return;

    player.frenzyEnergy = Math.max(0, player.frenzyEnergy - player.frenzyDrainRate * dt);
    if (time >= player.frenzyTrailAt) {
      this.addFrenzyTrail(player);
      player.frenzyTrailAt = time + 70;
    }
    if (player.frenzyEnergy <= 0) player.frenzyActive = false;
  }

  private bomb(player: PlayPlayer): void {
    const frontX = player.x + player.width / 2 + player.facing * TILE_SIZE;
    const frontY = player.y + player.height / 2;
    const center = this.grid.worldToTile(frontX, frontY);
    this.destroyBlockGroupsInArea(
      player,
      center.tileX - 1,
      center.tileY - 1,
      center.tileX + 1,
      center.tileY + 1,
    );
  }

  private blockClearBurst(player: PlayPlayer): void {
    const center = this.grid.worldToTile(player.x + player.width / 2, player.y + player.height / 2);
    this.destroyBlockGroupsInArea(
      player,
      center.tileX - BURST_RADIUS_TILES,
      center.tileY - BURST_RADIUS_TILES,
      center.tileX + BURST_RADIUS_TILES,
      center.tileY + BURST_RADIUS_TILES,
    );

    const { x, y } = this.grid.tileToWorldCenter(center.tileX, center.tileY);
    const ring = this.add.circle(x, y, TILE_SIZE * 1.6);
    ring.setStrokeStyle(4, 0xf97316, 0.7);
    ring.setDepth(32);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.7,
      duration: 180,
      onComplete: () => ring.destroy(),
    });
  }

  private destroyBlockGroupsInArea(
    player: PlayPlayer,
    minTileX: number,
    minTileY: number,
    maxTileX: number,
    maxTileY: number,
  ): void {
    const destroyedKeys = new Set<string>();
    for (let y = minTileY; y <= maxTileY; y++) {
      for (let x = minTileX; x <= maxTileX; x++) {
        for (const tile of this.grid.destroyConnectedBlockGroup(x, y)) {
          const key = `${tile.tileX},${tile.tileY}`;
          if (destroyedKeys.has(key)) continue;
          destroyedKeys.add(key);
          player.stats.blocksBroken += 1;
          this.redrawTile(tile.tileX, tile.tileY);
          this.addBreakFlash(tile.tileX, tile.tileY);
        }
      }
    }
    if (destroyedKeys.size > 0) this.settleBlocksAndResolveChains();
  }

  private stunBolt(player: PlayPlayer, time: number): void {
    const origin = playerCenter(player);
    const target = this.players
      .filter((candidate) => {
        if (candidate.slot === player.slot || !candidate.alive || candidate.finished) return false;
        const center = playerCenter(candidate);
        const forwardDistance = (center.x - origin.x) * player.facing;
        return (
          forwardDistance > 0 &&
          forwardDistance <= STUN_BOLT_RANGE &&
          Math.abs(center.y - origin.y) <= STUN_BOLT_LANE_HEIGHT
        );
      })
      .sort(
        (a, b) =>
          (playerCenter(a).x - origin.x) * player.facing -
          (playerCenter(b).x - origin.x) * player.facing,
      )[0];

    const end = target
      ? playerCenter(target)
      : { x: origin.x + player.facing * STUN_BOLT_RANGE, y: origin.y };
    const beam = this.add.line(0, 0, origin.x, origin.y, end.x, end.y, 0xa78bfa, 0.9);
    beam.setOrigin(0, 0);
    beam.setLineWidth(5, 2);
    beam.setDepth(34);
    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 150,
      onComplete: () => beam.destroy(),
    });

    if (!target) return;
    if (time < target.shieldUntil) {
      target.shieldView.setScale(1.18);
      this.tweens.add({ targets: target.shieldView, scale: 1, duration: 130 });
      return;
    }

    target.lastHitBy = player.slot;
    target.stunnedUntil = Math.max(target.stunnedUntil, time + STUN_BOLT_STUN_MS);
    target.vx = player.facing * 170;
    target.vy = Math.min(target.vy, -95);
    target.frenzyEnergy = Math.max(0, target.frenzyEnergy - STUN_BOLT_FRENZY_DRAIN);
    if (target.frenzyEnergy <= 0) target.frenzyActive = false;
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
      this.onPickupCollected(player, pickup.kind);
      if (pickup.kind === "gem") {
        player.stats.gems += 1;
      } else if (pickup.kind === "boostie") {
        player.frenzyEnergy = Math.min(
          FRENZY_MAX_ENERGY,
          player.frenzyEnergy + FRENZY_BOOSTIE_ENERGY,
        );
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
    player.stunnedUntil = this.time.now + this.tuning.respawnStunMs;
    player.view.setAlpha(1);
  }

  private resolvePlayerHits(time: number): void {
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i]!;
        const b = this.players[j]!;
        if (!a.alive || !b.alive || a.finished || b.finished) continue;
        if (!rectsOverlap(playerRect(a), playerRect(b))) continue;
        // Try each player as "attacker" — frenzy player shoves the other.
        // Regular overlap is handled once inside resolveHit when neither is in frenzy.
        const aFrenzy = a.frenzyActive;
        const bFrenzy = b.frenzyActive;
        if (aFrenzy || bFrenzy) {
          if (aFrenzy) this.resolveHit(a, b, time);
          if (bFrenzy) this.resolveHit(b, a, time);
        } else {
          // Neither in frenzy: simple separation (run once)
          this.resolveHit(a, b, time);
        }
      }
    }
  }

  private resolveHit(attacker: PlayPlayer, victim: PlayPlayer, time: number): void {
    const direction = attacker.x < victim.x ? -1 : 1;

    // Frenzy shove blocked by shield: reflect the attacker back
    if (attacker.frenzyActive && time < victim.shieldUntil) {
      attacker.vx = -attacker.facing * this.tuning.frenzyHitKnockbackX * 0.55;
      attacker.vy = Math.min(attacker.vy, -this.tuning.frenzyHitKnockbackY * 0.45);
      // Visual shield pulse
      victim.shieldView.setScale(1.18);
      this.tweens.add({ targets: victim.shieldView, scale: 1, duration: 130 });
      return;
    }

    // Frenzy shove hits unshielded victim
    if (attacker.frenzyActive) {
      victim.lastHitBy = attacker.slot;
      victim.stunnedUntil = time + this.tuning.frenzyHitStunMs;
      victim.vx = attacker.facing * this.tuning.frenzyHitKnockbackX;
      victim.vy = -this.tuning.frenzyHitKnockbackY;
      return;
    }

    // Regular body overlap: small bounce-apart, no stun
    attacker.vx = direction * this.tuning.overlapKnockbackX;
    victim.vx = -direction * this.tuning.overlapKnockbackX;
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

  private addFrenzyTrail(player: PlayPlayer): void {
    const ghost = this.add.image(
      player.x + player.width / 2,
      player.y + player.height / 2,
      textureKeyForVariant(variantForSlot(player.slot)),
    );
    ghost.setTint(Phaser.Display.Color.HexStringToColor(player.color).color);
    ghost.setFlipX(player.facing < 0);
    ghost.setAlpha(0.32);
    ghost.setDepth(10);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 0.72,
      duration: 180,
      onComplete: () => ghost.destroy(),
    });
  }

  private addFailedHitFlash(tileX: number, tileY: number): void {
    const { x, y } = this.grid.tileToWorldCenter(tileX, tileY);
    const fail = this.add.rectangle(x, y, TILE_SIZE - 4, TILE_SIZE - 4);
    fail.setStrokeStyle(3, 0xf8fafc, 0.72);
    fail.setDepth(31);
    this.tweens.add({
      targets: fail,
      alpha: 0,
      scale: 0.82,
      duration: 130,
      onComplete: () => fail.destroy(),
    });
  }

  private settleBlocksAndResolveChains(): void {
    this.animateBlockDrops(this.grid.settleBlockGravity());
    this.animateGrayChainExplosions(this.grid.resolveGrayChainExplosions());
  }

  private animateBlockDrops(drops: BlockDrop[]): void {
    if (drops.length === 0) return;

    const changedKeys = new Set<string>();
    for (const drop of drops) {
      changedKeys.add(`${drop.fromX},${drop.fromY}`);
      changedKeys.add(`${drop.toX},${drop.toY}`);
    }

    for (const key of changedKeys) {
      this.tileSprites.get(key)?.destroy();
      this.tileSprites.delete(key);
    }

    for (const drop of drops) {
      const texture = textureForTile(drop.kind);
      if (!texture) continue;

      const from = this.grid.tileToWorldCenter(drop.fromX, drop.fromY);
      const to = this.grid.tileToWorldCenter(drop.toX, drop.toY);
      const sprite = this.add.image(from.x, from.y, texture);
      sprite.setDepth(12);
      this.tweens.add({
        targets: sprite,
        y: to.y,
        duration: Math.min(260, 90 + (drop.toY - drop.fromY) * 42),
        ease: "Quad.easeIn",
        onComplete: () => {
          sprite.destroy();
          this.redrawTile(drop.toX, drop.toY);
        },
      });
    }
  }

  private animateGrayChainExplosions(explosions: GrayChainExplosion[]): void {
    for (const explosion of explosions) {
      for (const tile of explosion.destroyed) {
        this.redrawTile(tile.tileX, tile.tileY);
        this.addBreakFlash(tile.tileX, tile.tileY);
      }
      this.animateBlockDrops(explosion.drops);
    }
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
    player.body.setScale(player.frenzyActive ? 1.12 : 1);
    player.shieldView.setVisible(time < player.shieldUntil);
    if (player.powerup) {
      player.powerIcon.setTexture(textureForPowerup(player.powerup));
      player.powerIcon.setVisible(true);
    } else {
      player.powerIcon.setVisible(false);
    }
    player.label.setText(player.lives > 0 ? player.displayName : `${player.displayName} OUT`);
  }

  private cameraTargetX = 0;
  private cameraTargetY = 0;
  private readonly cameraLerpFactor = 0.08;

  private updateCamera(): void {
    // Exclude finished players from bounding box so camera tracks active racers
    const active = this.players.filter((player) => player.alive && !player.finished);
    const targets = active.length > 0 ? active : this.players.filter((p) => !p.finished);
    const pool = targets.length > 0 ? targets : this.players;

    const centers = pool.map((player) => ({
      x: player.x + player.width / 2,
      y: player.y + player.height / 2,
    }));
    const minX = Math.min(...centers.map((point) => point.x));
    const maxX = Math.max(...centers.map((point) => point.x));
    const minY = Math.min(...centers.map((point) => point.y));
    const maxY = Math.max(...centers.map((point) => point.y));

    const spreadTiles = Math.max(maxX - minX, maxY - minY) / TILE_SIZE;
    const centroidX = (minX + maxX) / 2;
    const centroidY = (minY + maxY) / 2;

    // If all active players are within 8 tiles, center on centroid; otherwise bounding box
    let targetX: number;
    let targetY: number;
    if (spreadTiles <= 8) {
      targetX = centroidX;
      targetY = centroidY;
    } else {
      targetX = centroidX;
      targetY = centroidY;
    }

    // Smooth lerp to target position
    this.cameraTargetX = Phaser.Math.Linear(this.cameraTargetX, targetX, this.cameraLerpFactor);
    this.cameraTargetY = Phaser.Math.Linear(this.cameraTargetY, targetY, this.cameraLerpFactor);

    const spanX = Math.max(420, maxX - minX + 260);
    const spanY = Math.max(260, maxY - minY + 190);
    const minZoom = this.mode === "race" ? 0.45 : 0.45;
    const maxZoom = 1.0;
    const zoom = Phaser.Math.Clamp(
      Math.min(this.scale.width / spanX, this.scale.height / spanY),
      minZoom,
      maxZoom,
    );
    const camera = this.cameras.main;
    camera.zoom = Phaser.Math.Linear(camera.zoom, zoom, this.cameraLerpFactor);
    camera.centerOn(this.cameraTargetX, this.cameraTargetY);
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
    case "redBlock":
      return TEXTURES.redBlock;
    case "blueBlock":
      return TEXTURES.blueBlock;
    case "yellowBlock":
      return TEXTURES.yellowBlock;
    case "greenBlock":
      return TEXTURES.greenBlock;
    case "grayBlock":
      return TEXTURES.grayBlock;
    case "steel":
      return TEXTURES.stone;
    case "gem":
      return TEXTURES.gem;
    case "boostie":
      return TEXTURES.boostie;
    case "dash":
      return TEXTURES.boostie;
    case "bomb":
      return TEXTURES.bomb;
    case "shield":
      return TEXTURES.shield;
    case "stunBolt":
      return TEXTURES.stunBolt;
    case "burst":
      return TEXTURES.burst;
    case "spikes":
      return TEXTURES.spikes;
    case "finish":
      return TEXTURES.finish;
    case "empty":
      return null;
  }
}

function textureForPowerup(kind: Exclude<PickupKind, "gem" | "boostie">): string {
  switch (kind) {
    case "bomb":
      return TEXTURES.bomb;
    case "shield":
      return TEXTURES.shield;
    case "stunBolt":
      return TEXTURES.stunBolt;
    case "burst":
      return TEXTURES.burst;
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

function playerCenter(player: PlayPlayer): Vec2 {
  return {
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
  };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function withRaceBots(players: PlayerSlot[]): PlayerSlot[] {
  if (players.length >= 4) return players;

  const usedSlots = new Set(players.map((player) => player.slot));
  const filled = [...players];
  for (let slot = 0; slot < 4 && filled.length < 4; slot++) {
    if (usedSlots.has(slot)) continue;
    filled.push({
      slot,
      profileId: `bot-${slot}`,
      displayName: `Bot ${slot + 1}`,
      color: BOT_COLORS[slot] ?? "#e5e7eb",
      gamepadIndex: -1,
    });
  }
  return filled.sort((a, b) => a.slot - b.slot);
}

function isBotSlot(player: PlayerSlot): boolean {
  return player.profileId?.startsWith("bot-") ?? false;
}

const BOT_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f97316"] as const;
