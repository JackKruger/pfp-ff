// Bot AI — generates player inputs each tick.
import { CONFIG, weaponStats } from "./config";
import type { Player, PlayerInput, BotTuning } from "./player";
import { weaponOf } from "./player";

const BOT_NAMES = [
  "old gareth", "iron jen", "dunmar", "training dummy",
  "ash-walker", "fenric", "halgrim", "boar of varn",
];
const WEAPONS = ["arming", "longsword", "mace", "spear"];

export const BOT_DIFFICULTY: Record<string, BotTuning> = {
  easy:   { aimSlop: 0.55, dodgeFactor: 0,   blockChance: 0.20, attackGapMs: 1400, commitChance: 0.85 },
  medium: { aimSlop: 0.30, dodgeFactor: 0.3, blockChance: 0.45, attackGapMs:  800, commitChance: 0.92 },
  hard:   { aimSlop: 0.15, dodgeFactor: 0.6, blockChance: 0.70, attackGapMs:  400, commitChance: 0.97 },
};

export function botDifficultyTuning(level = "medium"): BotTuning {
  return BOT_DIFFICULTY[level] ?? BOT_DIFFICULTY.medium;
}

const BOT_TAUNTS = [
  "yield, dog!", "another for the heap", "again? bring it.",
  "easy meat", "haha — coward!", "to the gibbet with you",
  "for the iron yard!", "stay down", "your bones, my keep",
];

export function pickBotTaunt(): string {
  return BOT_TAUNTS[(Math.random() * BOT_TAUNTS.length) | 0];
}

export function pickBotName(existing: Map<number, Player>): string {
  const used = new Set([...existing.values()].map(p => p.name));
  for (const n of BOT_NAMES) if (!used.has(`[bot] ${n}`)) return n;
  return BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0];
}

export function pickBotWeapon(): string {
  return WEAPONS[(Math.random() * WEAPONS.length) | 0];
}

interface RackInfo { x: number; z: number; weapon: string }

function findTarget(bot: Player, players: Map<number, Player>) {
  let best: Player | null = null;
  let bestD = Infinity;
  for (const p of players.values()) {
    if (p === bot || !p.alive) continue;
    const d = Math.hypot(p.pos.x - bot.pos.x, p.pos.z - bot.pos.z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best ? { p: best, dist: bestD } : null;
}

function detectStuck(bot: Player, nowMs: number): number {
  if (!bot._stuckMem) bot._stuckMem = { lastPos: { x: bot.pos.x, z: bot.pos.z }, lastSampleMs: nowMs, stuck: 0 };
  const m = bot._stuckMem;
  if (nowMs - m.lastSampleMs > 250) {
    const dist = Math.hypot(bot.pos.x - m.lastPos.x, bot.pos.z - m.lastPos.z);
    if (dist < 0.15) m.stuck++;
    else m.stuck = 0;
    m.lastPos.x = bot.pos.x; m.lastPos.z = bot.pos.z;
    m.lastSampleMs = nowMs;
  }
  return m.stuck;
}

function findNearestRack(bot: Player, racks: RackInfo[]) {
  let best: RackInfo | null = null;
  let bestD = Infinity;
  for (const r of racks) {
    const d2 = (r.x - bot.pos.x) ** 2 + (r.z - bot.pos.z) ** 2;
    if (d2 < bestD) { bestD = d2; best = r; }
  }
  return best ? { ...best, dist: Math.sqrt(bestD) } : null;
}

// Attack pose system
interface Pose { side: number; up: number; fwd: number }
const REST_POSE: Pose = { side: 0.30, up: -0.10, fwd: 0.55 };

const BOT_ATTACK_PHASES: Record<string, { windup: number; release: number; recovery: number }> = {
  swing:    { windup: 380, release: 240, recovery: 320 },
  overhead: { windup: 440, release: 280, recovery: 360 },
  stab:     { windup: 280, release: 180, recovery: 260 },
};

const BOT_POSES: Record<string, { chamber: Pose; contact: Pose; end: Pose }> = {
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

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function poseLerp(a: Pose, b: Pose, t: number): Pose {
  return { side: lerp(a.side, b.side, t), up: lerp(a.up, b.up, t), fwd: lerp(a.fwd, b.fwd, t) };
}
function easeInSlow(u: number) { return u * u; }
function easeOutFast(u: number) { return 1 - (1 - u) ** 2; }
function easeInOut(u: number) { return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; }

function chooseBotAttackTip(
  bot: Player, target: Player, yaw: number, dist: number, engage: number,
  w: ReturnType<typeof weaponOf>, tune: BotTuning, nowMs: number, targetStunned: boolean,
): { x: number; y: number; z: number } {
  const inRange = dist <= engage + 0.4;
  if (!bot._atk) bot._atk = { phase: "idle", start: 0, type: null, nextAtMs: 0 };
  const atk = bot._atk;

  if (atk.phase === "idle" && nowMs >= atk.nextAtMs && (inRange || targetStunned)) {
    const r = Math.random();
    if (w.key === "spear") atk.type = r < 0.65 ? "stab" : r < 0.85 ? "swing" : "overhead";
    else if (w.key === "mace") atk.type = r < 0.45 ? "swing" : r < 0.85 ? "overhead" : "stab";
    else if (w.key === "longsword") atk.type = r < 0.40 ? "swing" : r < 0.75 ? "overhead" : "stab";
    else atk.type = r < 0.55 ? "swing" : r < 0.85 ? "overhead" : "stab";
    if (Math.random() > tune.commitChance) atk.type = "feint";
    atk.start = nowMs;
    atk.phase = "windup";
  }

  const elapsed = nowMs - atk.start;
  const type = (atk.type === "feint" ? "swing" : atk.type) as string;
  const phases = type ? BOT_ATTACK_PHASES[type] : null;
  let pose: Pose | null = null;

  if (atk.phase === "windup" && phases) {
    const u = elapsed / phases.windup;
    if (u >= 1) {
      if (atk.type === "feint") { atk.phase = "recovery"; atk.start = nowMs; }
      else { atk.phase = "release"; atk.start = nowMs; }
    } else {
      pose = poseLerp(REST_POSE, BOT_POSES[type].chamber, easeInSlow(u));
    }
  }
  if (atk.phase === "release" && phases) {
    const re = nowMs - atk.start;
    if (re >= phases.release) { atk.phase = "recovery"; atk.start = nowMs; }
    else {
      const u = re / phases.release;
      const ue = easeOutFast(u);
      const a = BOT_POSES[type].chamber, b = BOT_POSES[type].contact, c = BOT_POSES[type].end;
      if (ue < 0.5) pose = poseLerp(a, b, ue / 0.5);
      else pose = poseLerp(b, c, (ue - 0.5) / 0.5);
    }
  }
  if (atk.phase === "recovery" && phases) {
    const rc = nowMs - atk.start;
    if (rc >= phases.recovery) {
      atk.phase = "idle"; atk.type = null;
      atk.nextAtMs = nowMs + tune.attackGapMs + ((bot.id * 73) % 200);
    } else {
      const u = rc / phases.recovery;
      const last = atk.type === "feint" ? BOT_POSES[type].chamber : BOT_POSES[type].end;
      pose = poseLerp(last, REST_POSE, easeInOut(u));
    }
  }

  if (!pose) pose = REST_POSE;
  const reach = w.length;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx =  Math.cos(yaw), rz = -Math.sin(yaw);
  return {
    x: bot.pos.x + rx * (pose.side * 0.6) + fx * (pose.fwd * reach),
    y: bot.pos.y + 1.40 + pose.up * 0.6,
    z: bot.pos.z + rz * (pose.side * 0.6) + fz * (pose.fwd * reach),
  };
}

export function botInput(
  bot: Player, players: Map<number, Player>, nowMs: number,
  racks?: RackInfo[],
): PlayerInput {
  const t = findTarget(bot, players);
  if (!t) {
    return { seq: 0, mv: { x: 0, y: 0 }, yaw: bot.yaw, sprint: false, jump: false,
             blocking: false, swinging: true, weaponTip: bot.weaponTip };
  }
  const target = t.p, dist = t.dist;
  const tune = bot.botTuning || botDifficultyTuning("medium");
  const aimSlop = tune.aimSlop;
  const yaw = Math.atan2(-(target.pos.x - bot.pos.x), -(target.pos.z - bot.pos.z))
    + Math.sin(nowMs / 480 + bot.id * 1.3) * aimSlop;

  const w = weaponOf(bot);
  const engage = w.length + 0.20;
  const tooClose = Math.max(0.6, w.length * 0.5);

  const tvx = target.weaponTipVel?.x || 0;
  const tvz = target.weaponTipVel?.z || 0;
  const tipSpd = Math.hypot(tvx, tvz);
  const tipDist = Math.hypot(bot.pos.x - target.weaponTip.x, bot.pos.z - target.weaponTip.z);
  const approach = (tvx * -(bot.pos.x - target.weaponTip.x) + tvz * -(bot.pos.z - target.weaponTip.z)) / Math.max(0.01, tipDist);
  const threat = tune.dodgeFactor > 0 && tipSpd > (5 / Math.max(0.3, tune.dodgeFactor))
    && tipDist < 2.5 && approach > (2 / Math.max(0.3, tune.dodgeFactor));

  const now = nowMs;
  const targetStunned = (target.stunUntilMs || 0) > now;
  const targetDisarmed = (target.disarmedUntilMs || 0) > now;
  const botBleedingBad = bot.bleedDmgPerSec > 6 && bot.hp < 60 && (bot.bleedUntilMs || 0) > now + 1000;
  const botHelpless = (bot.disarmedUntilMs || 0) > now || (bot.stunUntilMs || 0) > now;

  let mv = { x: 0, y: 0 };

  if (botHelpless) {
    const stunned = (bot.stunUntilMs || 0) > now;
    if (!stunned) {
      const rack = findNearestRack(bot, racks || []);
      let bestX: number | null = null, bestZ: number | null = null, bestD = Infinity;
      if (rack) { bestX = rack.x; bestZ = rack.z; bestD = rack.dist; }
      for (const q of players.values()) {
        if (q === bot) continue;
        const dropped = !q.alive || (q.stunUntilMs || 0) > now || (q.disarmedUntilMs || 0) > now;
        if (!dropped) continue;
        const d = Math.hypot(q.pos.x - bot.pos.x, q.pos.z - bot.pos.z);
        if (d < bestD) { bestD = d; bestX = q.pos.x; bestZ = q.pos.z; }
      }
      if (bestX != null && bestZ != null) {
        bot._rackYaw = Math.atan2(-(bestX - bot.pos.x), -(bestZ - bot.pos.z));
        mv.y = 1; mv.x = 0;
      } else {
        mv.y = -1; mv.x = Math.sin(now / 250 + bot.id) * 0.4;
      }
    } else {
      mv.y = -1; mv.x = Math.sin(now / 250 + bot.id) * 0.4;
    }
  } else if (botBleedingBad) {
    mv.y = -1; mv.x = Math.sin(now / 350 + bot.id) * 0.6;
  } else if (targetStunned || targetDisarmed) {
    mv.y = dist > engage * 0.7 ? 1 : 0.5;
  } else if (threat) {
    const px = -tvz, pz = tvx;
    const m = Math.hypot(px, pz) || 1;
    const sign = (bot.id % 2) ? 1 : -1;
    const wx = sign * px / m, wz = sign * pz / m;
    const cy = Math.cos(-yaw), sy = Math.sin(-yaw);
    mv.x = cy * wx + sy * wz;
    mv.y = -(-sy * wx + cy * wz);
  } else if (dist > engage) {
    mv.y = 1;
  } else if (dist < tooClose) {
    mv.y = -0.7;
    mv.x = ((bot.id % 2) ? 1 : -1) * 0.4;
  } else {
    if (!bot._circleDir || (bot._circleSwitchMs || 0) < nowMs) {
      bot._circleDir = Math.random() < 0.5 ? 1 : -1;
      bot._circleSwitchMs = nowMs + 1800 + Math.random() * 2200;
    }
    mv.x = bot._circleDir! * 0.75;
    mv.y = dist > engage * 1.05 ? 0.30 : (dist < engage * 0.85 ? -0.20 : 0);
  }

  const stuck = detectStuck(bot, nowMs);
  if (stuck >= 2) {
    mv.x = Math.sin(nowMs / 200 + bot.id * 1.7) * (0.7 + stuck * 0.05);
    mv.y = (stuck > 4 ? 0.5 : 1) * (Math.sign(mv.y || 1));
  }
  if (stuck >= 6) {
    mv.x = (bot.id % 2 ? 1 : -1) * 0.9;
    mv.y = -0.8;
  }

  const blocking = bot.hp < 30 && dist < engage * 1.3 && Math.random() < tune.blockChance;
  const tip = chooseBotAttackTip(bot, target, yaw, dist, engage, w, tune, nowMs, targetStunned);
  const jump = bot.onGround
    && ((Math.random() < 0.005 && dist < engage) || (stuck > 5 && Math.random() < 0.2));

  return {
    seq: (bot.lastInputSeq || 0) + 1,
    mv, yaw: (botHelpless && bot._rackYaw != null) ? bot._rackYaw : yaw,
    pitch: 0, sprint: botHelpless || (dist > engage * 1.8 && bot.hp > 50),
    jump, blocking, swinging: true,
    weaponTip: tip,
  };
}