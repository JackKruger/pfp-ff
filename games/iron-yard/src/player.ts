import { CONFIG, weaponStats, ATTACK_PHASES, ATTACK_POSES, REST_BY_KEY, poseLerp, easeInSlow, easeOutFast, easeInOut, type WeaponConfig, type Pose } from "./config";
import type { Vec3 } from "./math";
import { v, clone, add, scale, sub, norm, len } from "./math";
import { clampToArena } from "./arena";
import type { SpawnPoint } from "./arena";

let nextId = 1;

export interface PlayerInput {
  mv: { x: number; y: number };
  yaw: number;
  pitch?: number;
  sprint?: boolean;
  jump?: boolean;
  blocking?: boolean;
  swinging?: boolean;
  attackType?: string | null; // "swing" | "overhead" | "stab" | "feint" | null
  weaponTip?: Vec3;
  aimDX?: number; // right stick / mouse X offset
  aimDY?: number; // right stick / mouse Y offset
  seq?: number;
}

export interface Player {
  id: number;
  name: string;
  weaponKey: string;
  color: number;
  pos: Vec3;
  vel: Vec3;
  impulse: Vec3;
  yaw: number;
  pitch: number;
  onGround: boolean;
  hp: number;
  stamina: number;
  helmIntact: boolean;
  alive: boolean;
  deadAtMs: number;
  spawnedAtMs: number;

  // Weapon state
  weaponTip: Vec3;
  weaponTipPrev: Vec3;
  weaponTipVel: Vec3;
  weaponTipTarget?: Vec3;
  swinging: boolean;
  blocking: boolean;

  // Cooldowns
  lastHitAtMs: Map<number, number>;
  parryUntilMs: Map<number, number>;

  // Bot
  bot?: boolean;
  botTuning?: BotTuning;
  difficulty?: string;

  // Status effects
  crippledUntilMs: number;
  stunUntilMs: number;
  disarmedUntilMs: number;
  knockedDownUntilMs: number;
  commitStrikeUntilMs: number;
  severedLeg: boolean;
  severedArm: boolean;
  bleedUntilMs: number;
  bleedDmgPerSec: number;
  bleedAccum: number;

  // Stats
  score: number;
  deaths: number;
  roundDamage: number;
  killStreak: number;
  lastSlamAtMs: number;
  lastPickupAtMs: number;

  // Attack system
  attackType: string | null;
  attackT: number; // 0..1 progress through current attack phase
  attackPhase: "idle" | "windup" | "release" | "recovery";
  attackStartMs: number;
  attackNextAtMs: number;

  // Internal
  lastInputSeq: number;
  _lastTipVel: Vec3;
  _lastSpawnedRealMs: number;
  _stuckMem?: { lastPos: { x: number; z: number }; lastSampleMs: number; stuck: number };
  _circleDir?: number;
  _circleSwitchMs?: number;
  _atk?: BotAttackState;
  _rackYaw?: number;
  animTick: number;
}

export interface BotTuning {
  aimSlop: number;
  dodgeFactor: number;
  blockChance: number;
  attackGapMs: number;
  commitChance: number;
}

interface BotAttackState {
  phase: "idle" | "windup" | "release" | "recovery";
  start: number;
  type: string | null;
  nextAtMs: number;
}

export function makePlayer(name: string, spawn: { pos: Vec3; yaw: number }, weaponKey?: string): Player {
  const wkey = CONFIG.WEAPONS[weaponKey as keyof typeof CONFIG.WEAPONS] ? weaponKey! : CONFIG.DEFAULT_WEAPON;
  const now = Date.now();
  return {
    id: nextId++,
    name: (name || "knight").slice(0, 16),
    weaponKey: wkey,
    color: 0,
    pos: clone(spawn.pos),
    vel: v(),
    impulse: v(),
    yaw: spawn.yaw,
    pitch: 0,
    onGround: true,
    hp: CONFIG.PLAYER.hp,
    stamina: CONFIG.PLAYER.stamina,
    helmIntact: true,
    alive: true,
    deadAtMs: 0,
    spawnedAtMs: now,
    weaponTip: v(0, 1.2, 1.0),
    weaponTipPrev: v(0, 1.2, 1.0),
    weaponTipVel: v(),
    swinging: false,
    blocking: false,
    lastHitAtMs: new Map(),
    parryUntilMs: new Map(),
    crippledUntilMs: 0,
    stunUntilMs: 0,
    disarmedUntilMs: 0,
    knockedDownUntilMs: 0,
    commitStrikeUntilMs: 0,
    attackType: null,
    attackT: 0,
    attackPhase: "idle",
    attackStartMs: 0,
    attackNextAtMs: 0,
    severedLeg: false,
    severedArm: false,
    bleedUntilMs: 0,
    bleedDmgPerSec: 0,
    bleedAccum: 0,
    score: 0,
    deaths: 0,
    roundDamage: 0,
    killStreak: 0,
    lastSlamAtMs: 0,
    lastPickupAtMs: 0,
    lastInputSeq: 0,
    _lastTipVel: v(),
    _lastSpawnedRealMs: now,
    animTick: 0,
  };
}

export function weaponOf(p: Player): WeaponConfig {
  return weaponStats(p.weaponKey);
}

export function applyInput(p: Player, input: PlayerInput, dtMs: number) {
  const dt = dtMs / 1000;
  if (!p.alive) return;

  const nowMs = Date.now();
  if (nowMs < p.stunUntilMs || nowMs < p.knockedDownUntilMs) {
    input = { mv: { x: 0, y: 0 }, yaw: p.yaw, sprint: false, jump: false,
              blocking: false, swinging: false, weaponTip: p.weaponTip };
  }

  if (typeof input.yaw === "number") p.yaw = input.yaw;
  if (typeof input.pitch === "number")
    p.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, input.pitch));

  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const rx =  Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  const mv = input.mv || { x: 0, y: 0 };
  let mx = rx * mv.x + fx * mv.y;
  let mz = rz * mv.x + fz * mv.y;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }

  const STA = CONFIG.PLAYER;
  const wantSprint = !!input.sprint;
  const canSprint = wantSprint && p.stamina >= STA.minStaminaToSprint;
  const wantBlock = !!input.blocking;
  const canBlock = wantBlock && p.stamina >= STA.minStaminaToBlock;

  if (canSprint) p.stamina -= STA.staminaSprintCost * dt;
  if (canBlock)  p.stamina -= STA.staminaBlockCost  * dt;
  if (!canSprint && !canBlock) {
    p.stamina += STA.staminaRegen * dt;
  } else if (canBlock && !canSprint) {
    p.stamina += STA.staminaRegenBlocking * dt;
  }
  p.stamina = Math.max(0, Math.min(STA.stamina, p.stamina));

  let speed = CONFIG.PLAYER.moveSpeed * (canSprint ? CONFIG.PLAYER.sprintMult : 1);
  if (canBlock) speed *= 0.55;
  if (p.swinging) speed *= 0.75;
  if (Date.now() < p.crippledUntilMs) speed *= 0.45;
  if (p.severedLeg) speed *= 0.35;

  const targetVx = mx * speed;
  const targetVz = mz * speed;
  const accelRate = STA.accel ?? 28;
  const k = Math.min(1, dt * accelRate / Math.max(1, speed));
  p.vel.x += (targetVx - p.vel.x) * k;
  p.vel.z += (targetVz - p.vel.z) * k;

  if (p.onGround) {
    if (input.jump && p.stamina >= STA.staminaJumpCost) {
      p.vel.y = CONFIG.PLAYER.jumpVel;
      p.onGround = false;
      p.stamina -= STA.staminaJumpCost;
    }
  } else {
    p.vel.y += CONFIG.PHYSICS.gravity * dt;
  }

  p.pos.x += (p.vel.x + p.impulse.x) * dt;
  p.pos.y += (p.vel.y) * dt;
  p.pos.z += (p.vel.z + p.impulse.z) * dt;
  const decay = Math.exp(-dt * 6);
  p.impulse.x *= decay;
  p.impulse.z *= decay;
  if (Math.abs(p.impulse.x) < 0.05) p.impulse.x = 0;
  if (Math.abs(p.impulse.z) < 0.05) p.impulse.z = 0;

  if (p.pos.y <= 0) { p.pos.y = 0; p.vel.y = 0; p.onGround = true; }
  clampToArena(p.pos);

  p.swinging = !!input.swinging;
  p.blocking = canBlock;

  // Blocking hold: force tip to high guard position
  if (canBlock) {
    const bfx = -Math.sin(p.yaw), bfz = -Math.cos(p.yaw);
    const brx =  Math.cos(p.yaw), brz = -Math.sin(p.yaw);
    p.weaponTip = {
      x: p.pos.x + bfx * 0.7 + brx * 0.30,
      y: p.pos.y + 1.55,
      z: p.pos.z + bfz * 0.7 + brz * 0.30,
    };
  } else if (input.weaponTip) {
    p.weaponTipPrev = p.weaponTip;
    const w = weaponOf(p);
    const maxReach = w.length + 1.2;
    const tx = input.weaponTip.x - p.pos.x;
    const ty = input.weaponTip.y - (p.pos.y + 1.4);
    const tz = input.weaponTip.z - p.pos.z;
    const dr = Math.hypot(tx, ty, tz);
    if (dr > maxReach) {
      const kk = maxReach / dr;
      p.weaponTip = { x: p.pos.x + tx * kk, y: p.pos.y + 1.4 + ty * kk, z: p.pos.z + tz * kk };
    } else {
      p.weaponTip = { x: input.weaponTip.x, y: input.weaponTip.y, z: input.weaponTip.z };
    }
    const dx = p.weaponTip.x - p.weaponTipPrev.x;
    const dy = p.weaponTip.y - p.weaponTipPrev.y;
    const dz = p.weaponTip.z - p.weaponTipPrev.z;
    const teleport = (dx * dx + dy * dy + dz * dz) > 9;
    if (teleport) {
      p.weaponTipVel = v(0, 0, 0);
    } else {
      const dtSafe = Math.max(dt, 1 / 240);
      p.weaponTipVel = {
        x: dx / dtSafe - p.vel.x,
        y: dy / dtSafe - p.vel.y,
        z: dz / dtSafe - p.vel.z,
      };
    }
  }

  if (typeof input.seq === "number") p.lastInputSeq = input.seq;
}

export function playerCapsule(p: Player) {
  const half = CONFIG.PLAYER.height / 2;
  const r = CONFIG.PLAYER.radius;
  const a = { x: p.pos.x, y: p.pos.y + r,            z: p.pos.z };
  const b = { x: p.pos.x, y: p.pos.y + 2 * half - r, z: p.pos.z };
  return { a, b, r };
}

export function weaponSegment(p: Player) {
  const sy = 1.4;
  const sx = 0.25 * Math.cos(p.yaw);
  const sz = -0.25 * Math.sin(p.yaw);
  const grip = { x: p.pos.x + sx, y: p.pos.y + sy, z: p.pos.z + sz };
  return { grip, tip: clone(p.weaponTip) };
}

export function killPlayer(p: Player, nowMs: number) {
  p.alive = false;
  p.hp = 0;
  p.deadAtMs = nowMs;
  p.deaths++;
}

export function maybeRespawn(p: Player, spawn: { pos: Vec3; yaw: number }, nowMs: number): boolean {
  if (p.alive) return false;
  if (nowMs - p.deadAtMs < CONFIG.PLAYER.respawnMs) return false;
  p.pos = clone(spawn.pos);
  p.yaw = spawn.yaw;
  p.vel = v();
  p.impulse = v();
  p.hp = CONFIG.PLAYER.hp;
  p.stamina = CONFIG.PLAYER.stamina;
  p.helmIntact = true;
  p.crippledUntilMs = 0;
  p.stunUntilMs = 0;
  p.disarmedUntilMs = 0;
  p.knockedDownUntilMs = 0;
  p.severedLeg = false;
  p.severedArm = false;
  p.bleedUntilMs = 0;
  p.bleedDmgPerSec = 0;
  p.bleedAccum = 0;
  p.alive = true;
  const justSpawnedRecently = p._lastSpawnedRealMs && (nowMs - p._lastSpawnedRealMs) < 3000;
  p._lastSpawnedRealMs = nowMs;
  p.spawnedAtMs = justSpawnedRecently ? (nowMs + 1500) : nowMs;
  p.lastHitAtMs.clear();
  p.parryUntilMs.clear();
  return true;
}