// Game engine — adapted from server Room to run locally in the browser.
// Ties together physics, combat, bots, rendering, and PFP-FF SDK.

import * as THREE from "three";
import { createGameClient, type LaunchContext, type GameResult } from "@pfp/sdk";
import {
  CONFIG,
  weaponStats,
  ATTACK_POSES,
  ATTACK_PHASES,
  REST_BY_KEY,
  poseLerp,
  easeInSlow,
  easeOutFast,
  easeInOut,
} from "./config";
import { spawnPoints, weaponRacks, obstacles } from "./arena";
import {
  makePlayer,
  applyInput,
  maybeRespawn,
  weaponOf,
  type Player,
  type PlayerInput,
} from "./player";
import { resolveHits, type GameEvent } from "./combat";
import { botInput, pickBotName, pickBotWeapon, botDifficultyTuning } from "./bot";
import { PhysicsWorld, initRapier } from "./physics";
import { InputManager } from "./input";
import { buildScene } from "./scene";
import { buildCharacter, type CharacterRig } from "./character";
import * as audio from "./audio";
import { v } from "./math";

// Player colors
const PLAYER_COLORS = [0x9aa0a8, 0xc44b3c, 0x3c7ac4, 0x4ba34b];

// How fast the right stick turns a human player to face (radians/second).
const HUMAN_TURN_RATE = 3.2;

/**
 * Drives a human player's weapon tip through a swing arc while an attack is in
 * progress. Mirrors the bot's `chooseBotAttackTip` so player strikes actually
 * build tip velocity (and therefore register hits). The attack phase machine in
 * `tick()` owns phase/timing; this only computes the tip pose for the phase.
 */
function humanSwingTip(p: Player, now: number): { x: number; y: number; z: number } {
  const backhand = p.attackType === "backhand";
  const typeKey = backhand || !p.attackType ? "swing" : p.attackType;
  const poses = ATTACK_POSES[typeKey] ?? ATTACK_POSES.swing;
  const phases = ATTACK_PHASES[typeKey] ?? ATTACK_PHASES.swing;
  const rest = REST_BY_KEY[p.weaponKey] ?? REST_BY_KEY.arming;
  const elapsed = now - p.attackStartMs;

  let pose;
  if (p.attackPhase === "windup") {
    pose = poseLerp(rest, poses.chamber, easeInSlow(Math.min(1, elapsed / phases.windup)));
  } else if (p.attackPhase === "release") {
    const ue = easeOutFast(Math.min(1, elapsed / phases.release));
    pose =
      ue < 0.5
        ? poseLerp(poses.chamber, poses.contact, ue / 0.5)
        : poseLerp(poses.contact, poses.end, (ue - 0.5) / 0.5);
  } else {
    pose = poseLerp(poses.end, rest, easeInOut(Math.min(1, elapsed / phases.recovery)));
  }

  // Backhand is a mirrored swing — flip the sideways component.
  const side = backhand ? -pose.side : pose.side;
  const reach = weaponOf(p).length;
  const fx = -Math.sin(p.yaw),
    fz = -Math.cos(p.yaw);
  const rx = Math.cos(p.yaw),
    rz = -Math.sin(p.yaw);
  return {
    x: p.pos.x + rx * (side * 0.6) + fx * (pose.fwd * reach),
    y: p.pos.y + 1.4 + pose.up * 0.6,
    z: p.pos.z + rz * (side * 0.6) + fz * (pose.fwd * reach),
  };
}

export interface GameConfig {
  botCount: number;
  botDifficulty: string;
  scoreToWin: number;
}

// ---- Spark particle system ----
interface Spark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

function createSparkMesh(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.04, 4, 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffaa44 });
  return new THREE.Mesh(geo, mat);
}

export class Game {
  players: Map<number, Player>;
  physics: PhysicsWorld;
  ticks: number;
  lastTickMs: number;
  spawns: ReturnType<typeof spawnPoints>;
  spawnIdx: number;
  pendingHits: GameEvent[];
  matchPhase: "countdown" | "playing" | "intermission";
  phaseUntil: number;
  roundEndsAt: number;
  winnerId: number | null;
  winReason: string | null;
  roundIndex: number;

  // Rendering
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  sun: THREE.DirectionalLight;
  torchData: { flame: THREE.Mesh; light: THREE.PointLight; baseY: number; phase: number }[];
  rigs: Map<number, CharacterRig>;

  // Engine state
  input: InputManager;
  context: LaunchContext | null;
  running: boolean;
  botTarget: number;
  botDifficulty: string;
  scoreToWin: number;

  // Timers
  _simInterval: number | null;
  _renderId: number | null;
  startedAt: number;
  _lastWallClash: number;
  _lastHitSound: number;

  // ---- Issue 4: Screen shake ----
  shakeAmount: number;

  // ---- Issue 5: Hit flash ----
  hitFlashEl: HTMLDivElement;

  // ---- Issue 7: Sparks ----
  sparks: Spark[];

  // ---- Issue 9: Kill feed ----
  killFeedEl: HTMLDivElement;
  killFeedItems: { text: string; time: number }[];

  // ---- Issue 10: Prop meshes ----
  // (declared below)
  propMeshes3D: THREE.Mesh[];

  // ---- Issue 11: Helm fly-off ----
  helmFragments: { mesh: THREE.Mesh; bodyHandle?: number; spawnTime: number }[];

  // ---- Issue 12: Match events ----
  lastMatchEventTime: number;

  constructor() {
    this.players = new Map();
    this.physics = new PhysicsWorld(CONFIG.TICK_HZ);
    this.physics.spawnArenaStatics({
      size: CONFIG.ARENA.size,
      wallH: CONFIG.ARENA.wallH,
      pillars: obstacles(),
    });
    this.physics.spawnArenaProps([
      { x: -10, y: 0, z: -10 },
      { x: 10, y: 0, z: -10 },
      { x: -10, y: 0, z: 10 },
      { x: 10, y: 0, z: 10 },
      { x: 0, y: 0, z: -12 },
      { x: 0, y: 0, z: 12 },
    ]);
    this.ticks = 0;
    this.lastTickMs = Date.now();
    this.spawns = spawnPoints();
    this.spawnIdx = 0;
    this.pendingHits = [];
    this.matchPhase = "countdown";
    this.phaseUntil = Date.now() + CONFIG.MATCH.countdownMs;
    this.roundEndsAt = 0;
    this.winnerId = null;
    this.winReason = null;
    this.roundIndex = 1;
    this.input = new InputManager();
    this.context = null;
    this.running = false;
    this.botTarget = 1;
    this.botDifficulty = "medium";
    this.scoreToWin = CONFIG.MATCH.scoreToWin;
    this._simInterval = null;
    this._renderId = null;
    this.startedAt = Date.now();
    this._lastWallClash = 0;
    this._lastHitSound = 0;
    this.rigs = new Map();
    this.propMeshes3D = [];
    this.shakeAmount = 0;
    this.sparks = [];
    this.killFeedItems = [];
    this.helmFragments = [];
    this.lastMatchEventTime = 0;

    // Three.js setup
    const { scene, sun, torchData } = buildScene();
    this.scene = scene;
    this.sun = sun;
    this.torchData = torchData;

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.5, 80);
    this.camera.position.set(0, 8, 12);
    this.camera.lookAt(0, 1, 0);

    const canvas = document.getElementById("c") as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // ---- Issue 5: Hit flash overlay ----
    this.hitFlashEl = document.createElement("div");
    this.hitFlashEl.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;background:#fff;pointer-events:none;opacity:0;transition:opacity 0.08s;z-index:10";
    document.body.appendChild(this.hitFlashEl);

    // ---- Issue 9: Kill feed ----
    this.killFeedEl = document.createElement("div");
    this.killFeedEl.style.cssText =
      "position:absolute;top:60px;right:20px;width:300px;pointer-events:none;font-family:sans-serif;font-size:14px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.8);z-index:5";
    document.body.appendChild(this.killFeedEl);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  nextSpawn() {
    const s = this.spawns[this.spawnIdx % this.spawns.length];
    this.spawnIdx++;
    return s;
  }

  addPlayer(name: string, weaponKey?: string) {
    const p = makePlayer(name, this.nextSpawn(), weaponKey);
    p.color = PLAYER_COLORS[this.players.size % PLAYER_COLORS.length];
    this.players.set(p.id, p);
    this._attachPlayerPhysics(p);
    this._attachPlayerRig(p);
    return p;
  }

  addBot(difficulty = "medium") {
    const name = `[bot] ${pickBotName(this.players)}`;
    const p = makePlayer(name, this.nextSpawn(), pickBotWeapon());
    p.bot = true;
    p.botTuning = botDifficultyTuning(difficulty);
    p.difficulty = difficulty;
    p.color = PLAYER_COLORS[this.players.size % PLAYER_COLORS.length];
    this.players.set(p.id, p);
    this._attachPlayerPhysics(p);
    this._attachPlayerRig(p);
    return p;
  }

  _attachPlayerPhysics(p: Player) {
    const w = weaponOf(p);
    const startTip = { x: p.pos.x, y: p.pos.y + 1.4, z: p.pos.z - 0.3 };
    p.weaponTip = { ...startTip };
    p.weaponTipPrev = { ...startTip };
    this.physics.attachSword(p.id, w.mass, w.length, startTip);
    this.physics.attachBody(p.id, p.pos);
    this.physics.attachTorso(p.id, p.pos);
    this.physics.attachHead(p.id, p.pos);
  }

  _attachPlayerRig(p: Player) {
    const isHuman = !p.bot;
    const rig = buildCharacter({ color: p.color, weaponKey: p.weaponKey, isLocal: isHuman });
    this.rigs.set(p.id, rig);
    this.scene.add(rig.root);
  }

  removePlayer(id: number) {
    this.players.delete(id);
    this.physics.detachSword(id);
    this.physics.detachBody(id);
    this.physics.detachTorso(id);
    this.physics.detachHead(id);
    const rig = this.rigs.get(id);
    if (rig) {
      this.scene.remove(rig.root);
      this.rigs.delete(id);
    }
    for (const p of this.players.values()) {
      p.lastHitAtMs.delete(id);
      p.parryUntilMs.delete(id);
    }
  }

  ensureBots() {
    const humans = [...this.players.values()].filter((p) => !p.bot).length;
    let bots = [...this.players.values()].filter((p) => p.bot).length;
    let desired = 0;
    if (humans === 1) desired = Math.min(this.botTarget, CONFIG.MAX_PLAYERS - humans);
    while (bots < desired && this.players.size < CONFIG.MAX_PLAYERS) {
      this.addBot(this.botDifficulty);
      bots++;
    }
    while (bots > desired) {
      const botPlayer = [...this.players.values()].find((p) => p.bot);
      if (!botPlayer) break;
      this.removePlayer(botPlayer.id);
      bots--;
    }
  }

  start(context: LaunchContext) {
    this.context = context;
    this.startedAt = Date.now();

    // Issue 21: Bot difficulty from settings
    if (context.settings?.botDifficulty) {
      this.botDifficulty = context.settings.botDifficulty as string;
    }
    // Issue 23: Score-to-win from settings
    if (context.settings?.scoreToWin) {
      this.scoreToWin = context.settings.scoreToWin as number;
    }

    // Create human players from context
    for (const slot of context.players) {
      const p = this.addPlayer(slot.displayName);
      this.input.bindGamepad(p.id, slot.gamepadIndex);
      if (slot.gamepadIndex < 0) this.input.bindKeyboard(p.id, slot.slot);
    }

    // Add bots if only 1 human (practice mode)
    this.ensureBots();

    // Start game loop
    this.phaseUntil = Date.now() + CONFIG.MATCH.countdownMs;
    this.matchPhase = "countdown";

    this._simInterval = window.setInterval(() => this.step(), 1000 / CONFIG.TICK_HZ);
    this._renderId = requestAnimationFrame((t) => this.renderLoop(t));
  }

  stop() {
    this.running = false;
    if (this._simInterval !== null) clearInterval(this._simInterval);
    if (this._renderId !== null) cancelAnimationFrame(this._renderId);
  }

  endMatch() {
    this.stop();
    if (!this.context) return;

    const humans = [...this.players.values()].filter((p) => !p.bot);
    const humanSlots = new Map<number, number>();
    let si = 0;
    for (const p of humans) {
      humanSlots.set(p.id, si++);
    }

    const sorted = [...this.players.values()].sort((a, b) => b.score - a.score);
    let botSlotOffset = humans.length;
    const standings = sorted.map((p, i) => {
      const hSlot = humanSlots.get(p.id);
      const slot = hSlot !== undefined ? hSlot : botSlotOffset++;
      const ctxPlayer = this.context!.players.find((cp) => cp.slot === hSlot);
      return {
        slot,
        profileId: ctxPlayer?.profileId ?? null,
        rank: i + 1,
        score: p.score,
        stats: { kills: p.score, deaths: p.deaths },
      };
    });

    const result: GameResult = {
      gameId: "iron-yard",
      sessionId: this.context.sessionId,
      startedAt: this.startedAt,
      endedAt: Date.now(),
      standings,
    };
    client.gameOver(result);
  }

  // ---- Issue 7: Spawn sparks ----
  spawnSparks(
    worldPos: THREE.Vector3Like,
    color: THREE.Color = new THREE.Color(0xffaa44),
    count = 8,
  ) {
    const p = new THREE.Vector3(worldPos.x!, worldPos.y!, worldPos.z!);
    for (let i = 0; i < count; i++) {
      const mesh = createSparkMesh();
      mesh.position.copy(p);
      mesh.material = new THREE.MeshBasicMaterial({ color });
      this.scene.add(mesh);
      this.sparks.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 5 + 2,
          (Math.random() - 0.5) * 8,
        ),
        life: 0,
        maxLife: 0.15 + Math.random() * 0.25,
        color,
      });
    }
  }

  updateSparks(dt: number) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      if (s.life >= s.maxLife) {
        this.scene.remove(s.mesh);
        this.sparks.splice(i, 1);
        continue;
      }
      s.mesh.position.x += s.vel.x * dt;
      s.mesh.position.y += s.vel.y * dt;
      s.mesh.position.z += s.vel.z * dt;
      s.vel.y -= 9.8 * dt;
      const t = s.life / s.maxLife;
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      (s.mesh.material as THREE.MeshBasicMaterial).transparent = true;
      s.mesh.scale.setScalar(1 - t * 0.7);
    }
  }

  // ---- Main simulation step ----
  step() {
    const now = Date.now();
    this.lastTickMs = now;
    this.ticks++;
    const dtMs = 1000 / CONFIG.TICK_HZ;
    const dt = dtMs / 1000;
    const frozen = this.matchPhase === "countdown";

    // 1) Resolve inputs
    for (const p of this.players.values()) {
      let input: PlayerInput;
      if (p.bot && p.alive && !frozen) {
        input = botInput(p, this.players, now, weaponRacks());
      } else if (!p.bot && !frozen) {
        input = this.input.getInput(p.id, p.yaw);

        // Turn to face with the right stick X so players can aim their attacks.
        const turn = input.aimDX || 0;
        if (Math.abs(turn) > 0.001) {
          p.yaw -= turn * HUMAN_TURN_RATE * dt;
        }
        input.yaw = p.yaw;

        // Issue 1: Compute weapon tip target from right stick aim + player position
        const fx = -Math.sin(p.yaw),
          fz = -Math.cos(p.yaw);
        const rx = Math.cos(p.yaw),
          rz = -Math.sin(p.yaw);
        const w = weaponOf(p);
        const armLen = 0.6;
        const maxReach = w.length + 1.2;

        // Right stick Y raises/lowers the resting guard; X is reserved for turning.
        const aimDY = input.aimDY || 0;
        const aimSpeed = CONFIG.AIM_TIP_SPEED;

        // Calculate tip relative to player with aim offset
        let tipX = p.pos.x + fx * w.length * armLen;
        let tipY = p.pos.y + 1.4 + aimDY * aimSpeed * 0.6;
        let tipZ = p.pos.z + fz * w.length * armLen;

        // Clamp to max reach
        const dx = tipX - p.pos.x;
        const dy = tipY - (p.pos.y + 1.4);
        const dz = tipZ - p.pos.z;
        const dr = Math.hypot(dx, dy, dz);
        if (dr > maxReach) {
          const k = maxReach / dr;
          tipX = p.pos.x + dx * k;
          tipY = p.pos.y + 1.4 + dy * k;
          tipZ = p.pos.z + dz * k;
        }

        input.weaponTip = { x: tipX, y: tipY, z: tipZ };

        // Issue 2: Attack system for human players
        if (input.attackType && p.attackPhase === "idle" && now >= p.attackNextAtMs) {
          if (p.swinging) {
            p.attackType = input.attackType;
            p.attackPhase = "windup";
            p.attackStartMs = now;
          }
        }
      } else {
        input = {
          mv: { x: 0, y: 0 },
          yaw: p.yaw,
          sprint: false,
          jump: false,
          blocking: false,
          swinging: false,
          weaponTip: p.weaponTip,
          attackType: null,
          aimDX: 0,
          aimDY: 0,
        };
      }
      applyInput(p, input, dtMs);
      // While a human attack is mid-swing, drive the tip through the strike arc
      // so it builds the velocity combat needs. Bots animate their own tip.
      if (!p.bot && p.attackPhase !== "idle") {
        p.weaponTipTarget = humanSwingTip(p, now);
      } else {
        p.weaponTipTarget = { x: p.weaponTip.x, y: p.weaponTip.y, z: p.weaponTip.z };
      }
    }

    // 2) Sync physics bodies + drive swords
    for (const p of this.players.values()) {
      this.physics.setBodyPos(p.id, p.pos);
      const stunned = now < p.stunUntilMs;
      const dead = !p.alive;
      let disarmed = now < p.disarmedUntilMs;
      const knocked = now < p.knockedDownUntilMs;

      if (disarmed && !stunned && !dead && !p.severedArm) {
        const sw = this.physics.swordState(p.id);
        if (sw) {
          const dd = (sw.pos.x - p.pos.x) ** 2 + (sw.pos.z - p.pos.z) ** 2;
          if (dd < 1.0) {
            p.disarmedUntilMs = 0;
            disarmed = false;
          }
        }
      }
      if (stunned || dead || disarmed || knocked) {
        this.physics.setSwordGravity(p.id, true);
      } else {
        this.physics.setSwordGravity(p.id, false);
        this.physics.driveSword(p.id, p.weaponTipTarget!, dt);
      }
      if (!knocked && !dead) {
        this.physics.driveTorso(p.id, dt);
        this.physics.driveHead(p.id, dt);
      }
      const horizSpeed = Math.hypot(p.vel.x, p.vel.z);
      if (!knocked && !dead && p.onGround && horizSpeed > 0.5) {
        const stepHz = 1.5 + horizSpeed * 0.3;
        const phase = this.ticks * dt * stepHz * Math.PI * 2 + p.id * 0.7;
        this.physics.pushTorso(p.id, {
          x: 0,
          y: Math.sin(phase) * Math.min(1.5, horizSpeed * 0.4) * 0.06,
          z: 0,
        });
      }
    }
    this.physics.step();

    // 3) Read back physics sword pos+vel
    for (const p of this.players.values()) {
      const s = this.physics.swordState(p.id);
      if (!s) continue;
      p.weaponTip = s.pos;
      const v = {
        x: s.vel.x - (p.vel.x || 0),
        y: s.vel.y - (p.vel.y || 0),
        z: s.vel.z - (p.vel.z || 0),
      };
      const mag = Math.hypot(v.x, v.y, v.z);
      const lv = p._lastTipVel;
      const lmag = lv ? Math.hypot(lv.x, lv.y, lv.z) : 0;
      if (mag > 6 && lmag > 3) {
        const cosA = (v.x * lv.x + v.y * lv.y + v.z * lv.z) / (mag * lmag);
        if (cosA < -0.5) p.commitStrikeUntilMs = now + 250;
      }
      p._lastTipVel = v;
      p.weaponTipVel = v;
    }

    // Bleed ticks
    const tickSec = dtMs / 1000;
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      if (now < p.bleedUntilMs && p.bleedDmgPerSec > 0) {
        p.bleedAccum += p.bleedDmgPerSec * tickSec;
        const whole = Math.floor(p.bleedAccum);
        if (whole > 0) {
          p.bleedAccum -= whole;
          p.hp = Math.max(0, p.hp - whole);
          if (p.hp <= 0) {
            p.alive = false;
            p.hp = 0;
            p.deadAtMs = now;
            p.deaths++;
            p.killStreak = 0;
          }
        }
      }
    }

    // Respawn
    for (const p of this.players.values()) {
      if (!p.alive && maybeRespawn(p, this.nextSpawn(), now)) {
        if (p.bot) {
          const oldKey = p.weaponKey;
          const nw = pickBotWeapon();
          const w = weaponStats(nw);
          this.physics.swapWeapon(p.id, w.mass, w.length);
          p.weaponKey = nw;
          const rig = this.rigs.get(p.id);
          if (rig && oldKey !== nw) rig.swapWeapon(nw);
        }
        this.physics.resetSwordPos(p.id, { x: p.pos.x, y: p.pos.y + 1.4, z: p.pos.z });
        this.physics.resetRagPos(p.id, p.pos);
      }
    }

    // Issue 3: Enemy dropped-sword pickup
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      if ((p.lastPickupAtMs || 0) > now - 1000) continue;
      if (p.severedArm) continue;

      // Check weapon racks
      const racks = weaponRacks();
      for (const rk of racks) {
        const dd = (p.pos.x - rk.x) ** 2 + (p.pos.z - rk.z) ** 2;
        if (dd < 1.0 && p.weaponKey !== rk.weapon) {
          const oldKey = p.weaponKey;
          p.weaponKey = rk.weapon;
          p.lastPickupAtMs = now;
          const w = weaponOf(p);
          this.physics.swapWeapon(p.id, w.mass, w.length);
          const rig = this.rigs.get(p.id);
          if (rig && oldKey !== p.weaponKey) rig.swapWeapon(p.weaponKey);
          break;
        }
      }

      // Check dropped swords from dead/stunned/disarmed enemies
      if (p.weaponKey === "unarmed") continue;
      for (const q of this.players.values()) {
        if (q === p || q.alive || now - q.deadAtMs > 3000) continue;
        const dd = (p.pos.x - q.pos.x) ** 2 + (p.pos.z - q.pos.z) ** 2;
        if (dd < 1.5 && q.weaponKey && p.weaponKey !== q.weaponKey) {
          const oldKey = p.weaponKey;
          p.weaponKey = q.weaponKey;
          p.lastPickupAtMs = now;
          const w = weaponOf(p);
          this.physics.swapWeapon(p.id, w.mass, w.length);
          const rig = this.rigs.get(p.id);
          if (rig && oldKey !== p.weaponKey) rig.swapWeapon(p.weaponKey);
          break;
        }
      }
    }

    // Body slam
    if (this.matchPhase === "playing") {
      const arr = [...this.players.values()];
      const radius2 = CONFIG.PLAYER.radius * 2 * 1.05;
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        if (!p.alive) continue;
        if (now - (p.lastSlamAtMs || 0) < 700) continue;
        const pSp = Math.hypot(p.vel.x, p.vel.z);
        if (pSp < 5.5) continue;
        for (let j = 0; j < arr.length; j++) {
          if (i === j) continue;
          const q = arr[j];
          if (!q.alive) continue;
          if (now - q.spawnedAtMs < CONFIG.PLAYER.spawnInvulnMs) continue;
          const dx = q.pos.x - p.pos.x,
            dz = q.pos.z - p.pos.z;
          if (dx * dx + dz * dz > radius2 * radius2) continue;
          const dl = Math.sqrt(dx * dx + dz * dz) || 1;
          const slamMag = 4 + pSp * 0.9;
          q.impulse.x += (dx / dl) * slamMag;
          q.impulse.z += (dz / dl) * slamMag;
          q.stamina = Math.max(0, q.stamina - 18);
          this.physics.pushTorso(q.id, { x: (dx / dl) * 7, y: 1.5, z: (dz / dl) * 7 });
          p.vel.x *= 0.4;
          p.vel.z *= 0.4;
          p.stamina = Math.max(0, p.stamina - 10);
          p.lastSlamAtMs = now;

          // Issue 12: Slam event
          this.pendingHits.push({ kind: "slam", from: p.id, to: q.id });
          break;
        }
      }
    }

    // Combat + match phase
    if (this.matchPhase === "countdown") {
      if (now >= this.phaseUntil) {
        this.matchPhase = "playing";
        this.roundEndsAt = CONFIG.MATCH.roundTimeMs > 0 ? now + CONFIG.MATCH.roundTimeMs : 0;
        // Issue 12: matchStart event
        this.pendingHits.push({ kind: "matchStart", round: this.roundIndex });
      }
    } else if (this.matchPhase === "playing") {
      // Wall clashes
      const wallClashes = this.physics.drainWallClashes();
      for (const wc of wallClashes) {
        if (now - this._lastWallClash > 150) {
          audio.playWallClash();
          this._lastWallClash = now;
          // Issue 12: wallClash event
          this.pendingHits.push({ kind: "wallClash", at: wc.pos });
        }
      }

      const hits = resolveHits(this.players, now, this.physics);
      for (const e of hits) {
        this.pendingHits.push(e);

        // Audio
        if (e.kind === "hit") {
          if (e.kill) audio.playDeath();
          else audio.playHit((e.dmg as number) || 10);

          // Issue 4: Screen shake on hit
          const dmg = (e.dmg as number) || 0;
          this.shakeAmount = Math.max(this.shakeAmount, Math.min(0.5, dmg / 300));

          // Issue 5: Hit flash
          this.hitFlashEl.style.opacity = Math.min(0.3, dmg / 400).toString();

          // Issue 7: Sparks at hit point
          const at = e.at as { x: number; y: number; z: number } | undefined;
          if (at) {
            const color =
              e.zone === "head"
                ? new THREE.Color(0xff4444)
                : e.zone === "legs"
                  ? new THREE.Color(0x44aaff)
                  : new THREE.Color(0xffee88);
            this.spawnSparks(at, color);
          }

          // Issue 11: Helm fly-off on lethal headshot
          if (e.helmBreak && (e as any).kill) {
            const victim = this.players.get(e.to as number);
            if (victim) {
              const rig = this.rigs.get(victim.id);
              if (rig) {
                const helmMesh = rig.parts.helm;
                const helmWorldPos = new THREE.Vector3();
                helmMesh.getWorldPosition(helmWorldPos);
                // Detach helm mesh from rig
                rig.root.remove(helmMesh);
                helmMesh.position.copy(helmWorldPos);
                this.scene.add(helmMesh);
                this.helmFragments.push({
                  mesh: helmMesh as unknown as THREE.Mesh,
                  spawnTime: now,
                });
              }
            }
          }
        } else if (e.kind === "clash") {
          audio.playClash();

          // Issue 7: Sparks at clash point
          const at = e.at as { x: number; y: number; z: number } | undefined;
          if (at) {
            this.spawnSparks(at, new THREE.Color(0xffdd66));
          }
        }

        // Issue 22: Bot chat display
        if (e.kind === "chat") {
          this.killFeedItems.push({
            text: `<span style="color:#aaa">${e.name || "Bot"}</span>: ${e.text || ""}`,
            time: Date.now(),
          });
        }

        // Issue 9: Kill feed — add death messages
        if (e.kind === "hit" && (e as any).kill) {
          const killer = this.players.get(e.from as number);
          const victim = this.players.get(e.to as number);
          if (killer && victim) {
            const weaponName = weaponStats(killer.weaponKey).name;
            this.killFeedItems.push({
              text: `<span style="color:#ff6">${killer.name}</span> <span style="color:#888">${weaponName}</span> <span style="color:#f44">${victim.name}</span>`,
              time: Date.now(),
            });
          }
        }

        // Check score-to-win
        if (e.kind === "hit" && (e as any).kill) {
          const atk = this.players.get(e.from as number);
          if (atk && atk.score >= this.scoreToWin) {
            this.endRound(atk.id, "score", now);
            break;
          }
        }
      }

      // Round timeout
      if (this.matchPhase === "playing" && this.roundEndsAt > 0 && now >= this.roundEndsAt) {
        let topScore = -1,
          topId: number | null = null,
          tied = false;
        for (const p of this.players.values()) {
          if (p.score > topScore) {
            topScore = p.score;
            topId = p.id;
            tied = false;
          } else if (p.score === topScore) tied = true;
        }
        this.endRound(tied ? null : topId, "timeout", now);
      }
    } else if (this.matchPhase === "intermission") {
      if (now >= this.phaseUntil) {
        for (const p of this.players.values()) {
          p.score = 0;
          p.deaths = 0;
          p.alive = false;
          p.deadAtMs = 0;
          p.helmIntact = true;
          p.killStreak = 0;
          p.roundDamage = 0;
          p.severedLeg = false;
          p.attackPhase = "idle";
          p.attackType = null;
          p.attackT = 0;
        }
        this.matchPhase = "countdown";
        this.phaseUntil = now + CONFIG.MATCH.countdownMs;
        this.winnerId = null;
        this.winReason = null;
        this.roundIndex++;
        // Issue 12: matchStart event
        this.pendingHits.push({ kind: "matchStart", round: this.roundIndex });
      }
    }

    // Advance attack state machine for all players
    for (const p of this.players.values()) {
      if (p.attackPhase === "idle" || !p.alive) continue;
      const atkType = p.attackType === "backhand" || !p.attackType ? "swing" : p.attackType;
      const phases = ATTACK_PHASES[atkType] ?? ATTACK_PHASES.swing;
      const dur = phases[p.attackPhase] || 380;
      if (now - p.attackStartMs >= dur) {
        if (p.attackPhase === "windup") {
          p.attackPhase = "release";
          p.attackStartMs = now;
        } else if (p.attackPhase === "release") {
          p.attackPhase = "recovery";
          p.attackStartMs = now;
        } else if (p.attackPhase === "recovery") {
          p.attackPhase = "idle";
          p.attackType = null;
          p.attackStartMs = 0;
          p.attackNextAtMs = now + 200;
        }
      }
    }

    // Issue 13: Idle breathing/sway on weapon tip — add rest pose sway
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      if (p.attackPhase !== "idle") continue;
      // Add subtle sinusoidal sway to weapon target
      const swayT = this.ticks * dt * 1.5 + p.id * 0.5;
      const swayAmp = 0.03;
      if (p.weaponTipTarget) {
        p.weaponTipTarget.x += Math.sin(swayT) * swayAmp;
        p.weaponTipTarget.y += Math.cos(swayT * 0.7) * swayAmp * 0.5;
        p.weaponTipTarget.z += Math.cos(swayT) * swayAmp;
      }
    }
  }

  endRound(winnerId: number | null, reason: string, now: number) {
    this.matchPhase = "intermission";
    this.winnerId = winnerId;
    this.winReason = reason;
    this.phaseUntil = now + CONFIG.MATCH.intermissionMs;
    // Issue 12: matchEnd event
    this.pendingHits.push({ kind: "matchEnd", winnerId, reason });
    // Auto-end match after shorter timeout for quick party games
    if (this.scoreToWin === 1) {
      setTimeout(() => this.endMatch(), 4000);
    }
  }

  // ---- Rendering loop ----
  renderLoop(_t: number) {
    if (!this.running && !this.context) {
      this._renderId = requestAnimationFrame((t) => this.renderLoop(t));
      return;
    }

    // Find camera target: all human players
    const humanPlayers = [...this.players.values()].filter((p) => !p.bot);
    if (humanPlayers.length > 0) {
      let cx = 0,
        cz = 0,
        count = 0;
      for (const p of humanPlayers) {
        cx += p.pos.x;
        cz += p.pos.z;
        count++;
      }
      cx /= count;
      cz /= count;

      // Issue 4: Screen shake
      let shakeX = 0,
        shakeY = 0;
      if (this.shakeAmount > 0.01) {
        shakeX = (Math.random() - 0.5) * 2 * this.shakeAmount;
        shakeY = (Math.random() - 0.5) * 2 * this.shakeAmount * 0.5;
        this.shakeAmount *= 0.85; // decay
        if (this.shakeAmount < 0.01) this.shakeAmount = 0;
      }

      this.camera.position.x += (cx - this.camera.position.x) * 0.03 + shakeX;
      this.camera.position.z += (cz + 10 - this.camera.position.z) * 0.03 + shakeY;
      this.camera.lookAt(cx, 1, cz);
    }

    // Issue 5: Fade hit flash
    const flashOpacity = parseFloat(this.hitFlashEl.style.opacity);
    if (flashOpacity > 0.01) {
      this.hitFlashEl.style.opacity = (flashOpacity * 0.8).toString();
    } else {
      this.hitFlashEl.style.opacity = "0";
    }

    // Issue 6: Directional hit-from indicator (show arrows on HUD)
    // Handled in updateHud()

    // Issue 7: Update sparks
    this.updateSparks(1 / 60);

    // Issue 10: Update prop meshes
    this.updateProps();

    // Issue 11: Clean up helm fragments
    const now = Date.now();
    for (let i = this.helmFragments.length - 1; i >= 0; i--) {
      const hf = this.helmFragments[i];
      if (now - hf.spawnTime > 5000) {
        this.scene.remove(hf.mesh);
        this.helmFragments.splice(i, 1);
      }
    }

    // Update character rigs
    for (const [id, p] of this.players) {
      const rig = this.rigs.get(id);
      if (!rig) continue;
      rig.root.position.set(p.pos.x, p.pos.y, p.pos.z);
      rig.root.rotation.set(0, p.yaw, 0);

      const tipWorld = new THREE.Vector3(p.weaponTip.x, p.weaponTip.y, p.weaponTip.z);
      rig.weaponRig.lookAt(tipWorld);

      const tipSpeed = Math.hypot(p.weaponTipVel.x, p.weaponTipVel.y, p.weaponTipVel.z);

      // Issue 14: Idle sway already done in step()

      // Issue 2 + 15: Feed attack animation data
      let attackT = -1;
      let attackType: string | null = null;
      if (p.attackPhase !== "idle") {
        const phases: Record<string, number> = {
          windup: 380,
          release: 240,
          recovery: 320,
        };
        const dur = phases[p.attackPhase] || 380;
        attackT = Math.min(1, (now - p.attackStartMs) / dur);
        attackType = p.attackType;
      }

      const pw = weaponOf(p);
      rig.animate(1 / 60, {
        mvSpeed: Math.hypot(p.vel.x, p.vel.z),
        swinging: p.swinging,
        blocking: p.blocking,
        alive: p.alive,
        swingLat: p.weaponTipVel.x,
        swingFwd: p.weaponTipVel.z,
        crippled: Date.now() < p.crippledUntilMs,
        stunned: Date.now() < p.stunUntilMs,
        verAim: p.weaponTip.y - p.pos.y - 1.4,
        tipDist: Math.hypot(
          p.weaponTip.x - p.pos.x,
          p.weaponTip.y - p.pos.y - 1.4,
          p.weaponTip.z - p.pos.z,
        ),
        torsoRot: this.physics.torsoState(p.id)?.rot ?? null,
        headRot: this.physics.headState(p.id)?.rot ?? null,
        playerYaw: p.yaw,
        attackT,
        attackType,
        grip: pw.grip,
      });

      // Issue 8: 3D nameplate — we use CSS2D overlay handled in updateHud
      // But we also set the rig's nameplate position

      const invulnLeft = Math.max(0, CONFIG.PLAYER.spawnInvulnMs - (Date.now() - p.spawnedAtMs));
      rig.setInvuln(invulnLeft > 0, Date.now() / 1000);

      // Issue 14: Sword trail
      rig.pushTrail(tipWorld.clone(), tipSpeed);
    }

    // Torch flicker
    for (const t of this.torchData) {
      t.flame.position.y = t.baseY + Math.sin(Date.now() * 0.004 + t.phase) * 0.06;
      t.light.position.y = t.flame.position.y;
    }

    // Update HUD
    this.updateHud();

    this.renderer.render(this.scene, this.camera);
    this._renderId = requestAnimationFrame((t) => this.renderLoop(t));
  }

  updateProps() {
    const propStates = this.physics.propsState();
    while (this.propMeshes3D.length < propStates.length) {
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.95, 12),
        new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.9 }),
      );
      cyl.castShadow = true;
      this.scene.add(cyl);
      this.propMeshes3D.push(cyl);
    }
    for (let i = 0; i < propStates.length; i++) {
      const s = propStates[i];
      const m = this.propMeshes3D[i];
      if (!m) continue;
      m.position.set(s.pos.x, s.pos.y, s.pos.z);
      m.quaternion.set(s.rot.x, s.rot.y, s.rot.z, s.rot.w);
    }
  }

  updateHud() {
    const hud = document.getElementById("hud");
    if (!hud) return;
    const arr = [...this.players.values()];
    const colors = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];
    const phaseMsLeft = Math.max(0, this.phaseUntil - Date.now());
    let html = "";
    if (this.matchPhase === "countdown") {
      html += `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:48px;font-weight:bold;text-shadow:0 2px 8px rgba(0,0,0,0.8)">${Math.ceil(phaseMsLeft / 1000)}</div>`;
    } else if (this.matchPhase === "intermission") {
      const winner = this.winnerId != null ? this.players.get(this.winnerId) : null;
      html += `<div style="position:absolute;top:30%;left:50%;transform:translate(-50%,-50%);font-size:36px;font-weight:bold;text-shadow:0 2px 8px rgba(0,0,0,0.8)">${winner ? winner.name + " wins!" : "Draw!"}</div>`;
      // Show MVP (highest round damage)
      let mvp: Player | null = null;
      let maxDmg = 0;
      for (const p of arr) {
        if (p.roundDamage > maxDmg) {
          maxDmg = p.roundDamage;
          mvp = p;
        }
      }
      if (mvp) {
        html += `<div style="position:absolute;top:38%;left:50%;transform:translate(-50%,-50%);font-size:18px;color:#ffd700;text-shadow:0 1px 4px rgba(0,0,0,0.8)">MVP: ${mvp.name} (${maxDmg} dmg)</div>`;
      }
    }

    // Issue 8: 3D nameplates (HP bars above heads)
    for (const p of arr) {
      if (!p.alive) continue;
      const hpPct = Math.max(0, p.hp / CONFIG.PLAYER.hp);
      const hpColor = hpPct > 0.6 ? "#4ade80" : hpPct > 0.3 ? "#facc15" : "#ef4444";
      const screenPos = this.worldToScreen(p.pos.x, p.pos.y + 2.2, p.pos.z);
      if (!screenPos) continue;
      const nameTag = p.bot ? `[Bot] ${p.name}` : p.name;
      html += `
<div style="position:absolute;left:${screenPos.x}px;top:${screenPos.y}px;transform:translate(-50%,-100%);width:120px;font-size:11px;text-shadow:0 1px 3px rgba(0,0,0,0.8);pointer-events:none">
  <div style="display:flex;justify-content:space-between;margin-bottom:1px">
    <span style="color:${colors[Array.from(this.players.keys()).indexOf(p.id) % 4]};font-weight:bold">${nameTag}</span>
    <span style="font-size:10px">${p.score}/${p.deaths}D</span>
  </div>
  <div style="height:6px;background:#333;border-radius:3px;overflow:hidden">
    <div style="height:100%;width:${hpPct * 100}%;background:${hpColor};transition:width 0.1s;border-radius:3px"></div>
  </div>
  <div style="height:3px;background:#1a1a2e;margin-top:1px;border-radius:2px;overflow:hidden">
    <div style="height:100%;width:${(p.stamina / CONFIG.PLAYER.stamina) * 100}%;background:#60a5fa;border-radius:2px;transition:width 0.1s"></div>
  </div>
</div>`;
    }

    // Issue 6: Directional hit-from indicator
    for (const p of arr) {
      if (!p.alive) continue;
      const lastHitTime = Math.max(...Array.from(p.lastHitAtMs.values()), 0);
      if (Date.now() - lastHitTime > 1000) continue;
      // Find who hit last
      let lastAttacker: Player | null = null;
      let lastHitAt = 0;
      for (const [aid, hitTime] of p.lastHitAtMs) {
        if (hitTime > lastHitAt) {
          lastHitAt = hitTime;
          lastAttacker = this.players.get(aid) ?? null;
        }
      }
      if (lastAttacker && Date.now() - lastHitAt < 800) {
        const dx = lastAttacker.pos.x - p.pos.x;
        const dz = lastAttacker.pos.z - p.pos.z;
        const angle = Math.atan2(dx, dz);
        const indicatorX = 400 + Math.sin(angle) * 60;
        const indicatorY = 300 - Math.cos(angle) * 60;
        html += `<div style="position:absolute;left:${indicatorX}px;top:${indicatorY}px;font-size:24px;color:#ff4444;text-shadow:0 0 6px rgba(255,0,0,0.6);transform:translate(-50%,-50%) rotate(${-angle}rad)">⬇</div>`;
      }
    }

    // HP bars at bottom (keep original bottom HUD too)
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      const x = 10 + i * 200;
      const hpPct = Math.max(0, p.hp / CONFIG.PLAYER.hp);
      const hpColor = hpPct > 0.6 ? "#4ade80" : hpPct > 0.3 ? "#facc15" : "#ef4444";
      const nameTag = p.bot ? `[Bot] ${p.name}` : p.name;
      html += `
<div style="position:absolute;bottom:10px;left:${x}px;width:190px;font-size:12px;text-shadow:0 1px 3px rgba(0,0,0,0.8)">
  <div style="display:flex;justify-content:space-between;margin-bottom:2px">
    <span style="color:${colors[i % 4]};font-weight:bold">${nameTag}</span>
    <span>${p.alive ? "" : "💀"} ${p.score}/${p.deaths}D</span>
  </div>
  <div style="height:8px;background:#333;border-radius:4px;overflow:hidden">
    <div style="height:100%;width:${hpPct * 100}%;background:${hpColor};transition:width 0.1s;border-radius:4px"></div>
  </div>
  <div style="height:3px;background:#1a1a2e;margin-top:1px;border-radius:2px;overflow:hidden">
    <div style="height:100%;width:${(p.stamina / CONFIG.PLAYER.stamina) * 100}%;background:#60a5fa;border-radius:2px;transition:width 0.1s"></div>
  </div>
</div>`;
    }

    // Issue 9: Kill feed
    const killFeedLines: string[] = [];
    const now2 = Date.now();
    for (const item of this.killFeedItems) {
      if (now2 - item.time > 4000) continue;
      killFeedLines.push(item.text);
    }
    if (killFeedLines.length > 0) {
      html += `<div style="position:absolute;top:60px;right:20px;width:280px;text-align:right;font-size:13px;text-shadow:0 1px 3px rgba(0,0,0,0.8);pointer-events:none">${killFeedLines.map((t) => `<div style="margin-bottom:2px">${t}</div>`).join("")}</div>`;
    }

    hud.innerHTML = html;
  }

  worldToScreen(x: number, y: number, z: number): { x: number; y: number } | null {
    const vec = new THREE.Vector3(x, y, z);
    vec.project(this.camera);
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const sx = (vec.x * 0.5 + 0.5) * w;
    const sy = (-vec.y * 0.5 + 0.5) * h;
    if (vec.z > 1) return null;
    return { x: sx, y: sy };
  }
}

// ---- PFP SDK entry ----
const client = createGameClient();
let game: Game | null = null;

client.onLaunch(async (context: LaunchContext) => {
  await initRapier();

  game = new Game();

  const canvas = document.getElementById("c") as HTMLCanvasElement;
  const resize = () => game!.resize(canvas.clientWidth, canvas.clientHeight);
  window.addEventListener("resize", resize);
  resize();

  game.start(context);
  game.running = true;

  // Resume audio context on first interaction
  document.addEventListener("click", () => audio.resumeAudio(), { once: true });
  document.addEventListener("keydown", () => audio.resumeAudio(), { once: true });
});

client.ready();
