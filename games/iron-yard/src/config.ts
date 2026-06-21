// All tunables — merged from server+client configs.

export interface Pose { side: number; up: number; fwd: number }

export const WEAPON_REST_POSES: Record<string, Pose> = {
  arming:      { side: 0.25, up: 0.15, fwd: 0.30 },
  longsword:   { side: 0.35, up: -0.05, fwd: 0.28 },
  mace:        { side: 0.15, up: 0.40, fwd: 0.15 },
  spear:       { side: 0.0,  up: 0.60, fwd: 0.45 },
  swordshield: { side: 0.20, up: 0.15, fwd: 0.28 },
};

export const REST_BY_KEY = WEAPON_REST_POSES;

export const ATTACK_PHASES: Record<string, { windup: number; release: number; recovery: number }> = {
  swing:    { windup: 380, release: 240, recovery: 320 },
  overhead: { windup: 440, release: 280, recovery: 360 },
  stab:     { windup: 280, release: 180, recovery: 260 },
};

export const ATTACK_POSES: Record<string, { chamber: Pose; contact: Pose; end: Pose }> = {
  swing: {
    chamber: { side: -1.0, up: 0.55,  fwd: -0.30 },
    contact: { side:  0.20, up: 0.45, fwd:  1.40 },
    end:     { side:  1.10, up: -0.20, fwd:  0.30 },
  },
  overhead: {
    chamber: { side:  0.40, up: 1.40, fwd: -0.40 },
    contact: { side:  0.10, up: 0.20, fwd:  1.30 },
    end:     { side: -0.20, up: -0.85, fwd:  0.95 },
  },
  stab: {
    chamber: { side:  0.10, up: 0.05, fwd:  0.05 },
    contact: { side:  0.20, up: 0.20, fwd:  1.00 },
    end:     { side:  0.30, up: 0.30, fwd:  1.90 },
  },
};

export const CONFIG = {
  TICK_HZ: 30,
  SNAP_HZ: 30,
  MAX_PLAYERS: 4,
  ARENA: { size: 30, wallH: 4 },
  PLAYER: {
    radius: 0.4,
    height: 1.8,
    eyeY: 1.65,
    moveSpeed: 4.5,
    sprintMult: 1.6,
    jumpVel: 5.5,
    hp: 100,
    respawnMs: 3000,
    spawnInvulnMs: 1500,
    reconnectGraceMs: 15000,
    accel: 28,
    stamina: 100,
    staminaRegen: 22,
    staminaRegenBlocking: 6,
    staminaSprintCost: 28,
    staminaBlockCost: 8,
    staminaSwingCost: 14,
    staminaJumpCost: 18,
    minStaminaToSprint: 10,
    minStaminaToBlock: 6,
    minStaminaToSwing: 0,
    exhaustedDamageMul: 0.5,
  },
  DEFAULT_WEAPON: "arming",
  WEAPONS: {
    arming: {
      key: "arming", name: "arming sword", grip: "one-hand",
      length: 1.10, mass: 2.20, edgeHalfWidth: 0.04,
      minSpeed: 3.5, speedScale: 5.0, maxDmg: 55, minDmg: 8,
      hitCooldownMs: 500, swingMass: 1.0,
      damageType: "slash",
    },
    longsword: {
      key: "longsword", name: "longsword", grip: "two-hand",
      length: 1.30, mass: 3.10, edgeHalfWidth: 0.045,
      minSpeed: 3.0, speedScale: 6.0, maxDmg: 75, minDmg: 12,
      hitCooldownMs: 650, swingMass: 1.4,
      damageType: "slash",
    },
    swordshield: {
      key: "swordshield", name: "arming + shield", grip: "shield",
      length: 1.10, mass: 2.20, edgeHalfWidth: 0.04,
      minSpeed: 3.5, speedScale: 5.0, maxDmg: 55, minDmg: 8,
      hitCooldownMs: 500, swingMass: 1.0,
      damageType: "slash", shieldBonus: true,
    },
    mace: {
      key: "mace", name: "mace", grip: "one-hand",
      length: 0.80, mass: 2.80, edgeHalfWidth: 0.07,
      minSpeed: 2.8, speedScale: 7.0, maxDmg: 90, minDmg: 16,
      hitCooldownMs: 700, swingMass: 1.5,
      blunt: true,
      damageType: "blunt",
    },
    spear: {
      key: "spear", name: "spear", grip: "two-hand",
      length: 2.10, mass: 2.40, edgeHalfWidth: 0.035,
      minSpeed: 4.0, speedScale: 6.5, maxDmg: 70, minDmg: 10,
      hitCooldownMs: 550, swingMass: 1.2,
      thrustBonus: true,
      damageType: "pierce",
    },
  },
  MATCH: {
    scoreToWin: 5,
    intermissionMs: 6000,
    countdownMs: 3000,
    roundTimeMs: 180000,
    minPlayersToStart: 1,
  },
  COMBAT: {
    blockReductionFront: 0.85,
    shieldBlockBonus: 0.20,
    blockReductionSide: 0.40,
    bluntBlockPenalty: 0.30,
    parrySpeedMin: 9.0,
    parryRadius: 0.30,
    zone: {
      headDamageMul: 1.8,
      torsoDamageMul: 1.0,
      legsDamageMul: 0.7,
    },
  },
  PHYSICS: {
    gravity: -18,
  },
  AIM_TIP_SPEED: 8.0,
  INPUT_HZ: 60,
  MOUSE_SENS: 0.0022,
  WEAPON_MOUSE_SENS: 0.004,
};

export interface WeaponConfig {
  key: string;
  name: string;
  grip: string;
  length: number;
  mass: number;
  edgeHalfWidth: number;
  minSpeed: number;
  speedScale: number;
  maxDmg: number;
  minDmg: number;
  hitCooldownMs: number;
  swingMass: number;
  damageType: string;
  blunt?: boolean;
  thrustBonus?: boolean;
  shieldBonus?: boolean;
}

export const WEAPONS_LIST = ["arming", "longsword", "mace", "spear", "swordshield"] as const;
export type WeaponKey = (typeof WEAPONS_LIST)[number];

export function weaponStats(key: string): WeaponConfig {
  return (CONFIG.WEAPONS as Record<string, WeaponConfig>)[key] ?? CONFIG.WEAPONS.arming;
}

// Helper functions for poses
export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
export function poseLerp(a: Pose, b: Pose, t: number): Pose {
  return { side: lerp(a.side, b.side, t), up: lerp(a.up, b.up, t), fwd: lerp(a.fwd, b.fwd, t) };
}
export function easeInSlow(u: number) { return u * u; }
export function easeOutFast(u: number) { return 1 - (1 - u) ** 2; }
export function easeInOut(u: number) { return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; }