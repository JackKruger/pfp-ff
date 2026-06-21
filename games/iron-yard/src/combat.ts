// Combat hit resolution — ported from server/src/combat.js.

import { CONFIG, weaponStats } from "./config";
import type { Player } from "./player";
import { playerCapsule, killPlayer, weaponOf } from "./player";
import type { Vec3 } from "./math";
import { sub, len, norm, dot } from "./math";
import type { PhysicsWorld } from "./physics";
import { pickBotTaunt } from "./bot";

export interface GameEvent {
  kind: string;
  [key: string]: unknown;
}

export function resolveHits(
  players: Map<number, Player>,
  nowMs: number,
  physics: PhysicsWorld,
): GameEvent[] {
  const events: GameEvent[] = [];

  // Sword-vs-sword clashes
  for (const c of physics.drainPhysicsClashes()) {
    const a = players.get(c.a), b = players.get(c.b);
    if (!a || !b) continue;
    if (c.speed < CONFIG.COMBAT.parrySpeedMin) continue;
    const until = nowMs + 250;
    a.parryUntilMs.set(b.id, until);
    b.parryUntilMs.set(a.id, until);

    const aSp = len(a.weaponTipVel);
    const bSp = len(b.weaponTipVel);
    let disarmed: Player | null = null;
    if (c.speed > 12 && Math.abs(aSp - bSp) > 4) {
      disarmed = aSp < bSp ? a : b;
      disarmed.disarmedUntilMs = Math.max(disarmed.disarmedUntilMs, nowMs + 1500);
    }
    events.push({
      kind: "clash", a: a.id, b: b.id, speed: c.speed,
      disarmed: disarmed ? disarmed.id : 0,
      at: { x: (a.weaponTip.x + b.weaponTip.x) / 2, y: (a.weaponTip.y + b.weaponTip.y) / 2, z: (a.weaponTip.z + b.weaponTip.z) / 2 },
    });
  }

  // Sword-hits-body damage
  for (const c of physics.drainContacts()) {
    const a = players.get(c.attackerId), t = players.get(c.victimId);
    if (!a || !t) continue;
    if (!a.alive || a.blocking || !t.alive) continue;
    if (nowMs - a.spawnedAtMs < CONFIG.PLAYER.spawnInvulnMs) continue;
    if (nowMs - t.spawnedAtMs < CONFIG.PLAYER.spawnInvulnMs) continue;

    const w = weaponOf(a);
    const tipSpeed = c.speed;
    if (tipSpeed < w.minSpeed) continue;
    const last = a.lastHitAtMs.get(t.id) || 0;
    if (nowMs - last < w.hitCooldownMs) continue;
    const parryUntil = a.parryUntilMs.get(t.id) || 0;
    if (nowMs < parryUntil) continue;

    // Hit zone
    const cap = playerCapsule(t);
    const segLen = cap.b.y - cap.a.y;
    const tParam = Math.max(0, Math.min(1, (a.weaponTip.y - cap.a.y) / Math.max(0.01, segLen)));
    let zoneMul = CONFIG.COMBAT.zone.torsoDamageMul;
    let zone = "torso";
    if (tParam > 0.85)      { zoneMul = CONFIG.COMBAT.zone.headDamageMul; zone = "head"; }
    else if (tParam < 0.45) { zoneMul = CONFIG.COMBAT.zone.legsDamageMul; zone = "legs"; }

    // Damage formula
    const massFactor = 0.6 + w.mass * 0.4;
    let dmg = (tipSpeed - w.minSpeed) * w.speedScale * massFactor;
    if (a.stamina <= 5) dmg *= CONFIG.PLAYER.exhaustedDamageMul;
    if ((a.commitStrikeUntilMs || 0) > nowMs) dmg *= 1.30;
    if (w.thrustBonus) {
      const grip = { x: a.pos.x, y: a.pos.y + 1.4, z: a.pos.z };
      const swordDir = norm(sub(a.weaponTip, grip));
      const tipVdir  = norm(a.weaponTipVel);
      const align = Math.max(0, dot(swordDir, tipVdir));
      dmg *= (1 + align * 0.4);
    }
    dmg *= zoneMul;
    if (dmg < (w.minDmg || 0) * 0.5) continue;
    dmg = Math.max(w.minDmg ?? 0, Math.min(w.maxDmg ?? 999, dmg));

    // Block reduction (Issue 18: shield bonus)
    if (t.blocking) {
      const toAttacker = norm(sub(a.pos, t.pos));
      const targetForward = { x: -Math.sin(t.yaw), y: 0, z: -Math.cos(t.yaw) };
      const facing = dot(toAttacker, targetForward);
      let red = facing > 0.5 ? CONFIG.COMBAT.blockReductionFront
            : facing > 0    ? CONFIG.COMBAT.blockReductionSide
            : 0;
      if (w.blunt) red = Math.max(0, red - CONFIG.COMBAT.bluntBlockPenalty);
      // Shield bonus
      const tWeapon = weaponStats(t.weaponKey);
      if (tWeapon.shieldBonus) red = Math.min(1, red + CONFIG.COMBAT.shieldBlockBonus);
      dmg *= (1 - red);
    }
    dmg = Math.round(dmg);
    if (dmg <= 0) continue;

    // Helmet save
    let helmBroken = false;
    if (zone === "head" && t.helmIntact && dmg >= t.hp) {
      const survival = 5 + Math.floor(Math.random() * 11);
      dmg = Math.max(1, t.hp - survival);
      t.helmIntact = false;
      helmBroken = true;
    }

    t.hp = Math.max(0, t.hp - dmg);
    a.lastHitAtMs.set(t.id, nowMs);
    a.stamina = Math.max(0, a.stamina - CONFIG.PLAYER.staminaSwingCost);
    a.roundDamage = (a.roundDamage || 0) + dmg;

    if (dmg > 80 && t.hp > 0) {
      t.knockedDownUntilMs = Math.max(t.knockedDownUntilMs, nowMs + 1500);
      const dir = norm(sub(t.pos, a.pos));
      physics.pushTorso(t.id, { x: dir.x * 8, y: 2, z: dir.z * 8 });
      events.push({ kind: "knockdown", id: t.id, at: { x: t.pos.x, y: t.pos.y, z: t.pos.z } });
    }

    const kb = norm(sub(t.pos, a.pos));
    const kbMag = 4.0 + (zone === "head" ? 2.0 : 0.5) + tipSpeed * 0.14;
    t.impulse.x += kb.x * kbMag;
    t.impulse.z += kb.z * kbMag;

    const recoilMag = (1.2 + tipSpeed * 0.06) * (w.mass / 3.0);
    physics.pushTorso(a.id, { x: -kb.x * recoilMag, y: 0.3, z: -kb.z * recoilMag });
    const sw = physics.swords.get(a.id);
    if (sw) {
      const v = sw.body.linvel();
      sw.body.setLinvel({ x: v.x * 0.30, y: v.y * 0.30, z: v.z * 0.30 }, true);
    }

    if (zone === "legs") {
      t.vel.x *= 0.4; t.vel.z *= 0.4;
      t.crippledUntilMs = nowMs + 3000;
      if (!t.severedLeg && (w.damageType === "slash" || w.damageType === "pierce") && dmg >= 35 && Math.random() < 0.35) {
        t.severedLeg = true;
        events.push({ kind: "sever", id: t.id, limb: "leg", at: { x: t.pos.x, y: t.pos.y + 0.3, z: t.pos.z } });
      }
    } else if (zone === "torso" && t.hp > 0) {
      if (!t.severedArm && (w.damageType === "slash" || w.damageType === "pierce") && dmg >= 35 && Math.random() < 0.20) {
        t.severedArm = true;
        t.disarmedUntilMs = Math.max(t.disarmedUntilMs, nowMs + 3_600_000);
        events.push({ kind: "sever", id: t.id, limb: "arm", at: { x: t.pos.x, y: t.pos.y + 1.2, z: t.pos.z } });
      }
    }

    const dmgType = w.damageType || "slash";
    let stunMsApplied = 0, bleedTotalApplied = 0;
    if (dmgType === "blunt") {
      const stunChance = Math.min(0.85, 0.20 + dmg * 0.012);
      if (Math.random() < stunChance) {
        stunMsApplied = (zone === "head" ? 2200 : 1400) + Math.min(600, dmg * 8);
        t.stunUntilMs = Math.max(t.stunUntilMs, nowMs + stunMsApplied);
      }
    } else if (dmgType === "slash" || dmgType === "pierce") {
      bleedTotalApplied = Math.max(3, Math.round(dmg * (dmgType === "pierce" ? 0.55 : 0.35)));
      const durMs = dmgType === "pierce" ? 4500 : 4000;
      t.bleedDmgPerSec = Math.max(t.bleedDmgPerSec, bleedTotalApplied / (durMs / 1000));
      t.bleedUntilMs = Math.max(t.bleedUntilMs, nowMs + durMs);
    }

    const event: GameEvent = {
      kind: "hit",
      from: a.id, to: t.id, dmg, speed: tipSpeed, zone, weapon: w.key,
      damageType: dmgType,
      at: { x: a.weaponTip.x, y: cap.a.y + segLen * tParam, z: a.weaponTip.z },
    };
    if (helmBroken)        event.helmBreak = true;
    if (stunMsApplied)     event.stun  = stunMsApplied;
    if (bleedTotalApplied) event.bleed = bleedTotalApplied;
    if (t.hp <= 0) {
      killPlayer(t, nowMs);
      a.score++;
      a.killStreak = (a.killStreak || 0) + 1;
      t.killStreak = 0;
      event.kill = true;
      event.attackerStreak = a.killStreak;
      if (a.killStreak === 3 || a.killStreak === 5 || a.killStreak === 7 || a.killStreak >= 10) {
        events.push({ kind: "streak", id: a.id, count: a.killStreak });
      }
      if (a.bot && Math.random() < 0.5) {
        events.push({ kind: "chat", from: a.id, name: a.name, text: pickBotTaunt() });
      }
    }
    events.push(event);
  }

  return events;
}