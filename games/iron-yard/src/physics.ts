// Rapier3D physics wrapper — runs in the browser.

import RAPIER from "@dimforge/rapier3d-compat";
import { CONFIG } from "./config";
import type { Vec3 } from "./math";

const GROUP_BODY  = 0x0001;
const GROUP_SWORD = 0x0002;
const GROUPS_BODY_COLLIDER  = (GROUP_BODY  << 16) | GROUP_SWORD;
const GROUPS_SWORD_COLLIDER = (GROUP_SWORD << 16) | (GROUP_BODY | GROUP_SWORD);

let initialized = false;

export async function initRapier() {
  if (initialized) return;
  await RAPIER.init();
  initialized = true;
}

export function isRapierReady() { return initialized; }

export class PhysicsWorld {
  world: RAPIER.World;
  eventQueue: RAPIER.EventQueue;
  swords: Map<number, { body: RAPIER.RigidBody; collider: RAPIER.Collider; weaponMass: number; length: number }>;
  bodies: Map<number, { body: RAPIER.RigidBody; collider: RAPIER.Collider }>;
  torsos: Map<number, { body: RAPIER.RigidBody; joint: RAPIER.ImpulseJoint }>;
  heads: Map<number, { body: RAPIER.RigidBody; joint: RAPIER.ImpulseJoint }>;
  props: { body: RAPIER.RigidBody }[];
  colliderToPlayerSword: Map<number, number>;
  colliderToPlayerBody: Map<number, number>;
  wallColliders: Set<number>;
  _contacts: Map<number, Map<number, number>>;
  _clashes: { a: number; b: number; speed: number }[];
  _wallClashes: { id: number; speed: number; pos: Vec3 }[];

  constructor(tickHz = 30) {
    this.world = new RAPIER.World({ x: 0, y: -18, z: 0 });
    this.world.timestep = 1 / tickHz;
    this.eventQueue = new RAPIER.EventQueue(true);
    this.swords = new Map();
    this.bodies = new Map();
    this.torsos = new Map();
    this.heads = new Map();
    this.props = [];
    this.colliderToPlayerSword = new Map();
    this.colliderToPlayerBody = new Map();
    this.wallColliders = new Set();
    this._contacts = new Map();
    this._clashes = [];
    this._wallClashes = [];
  }

  attachBody(playerId: number, pos: Vec3) {
    if (this.bodies.has(playerId)) this.detachBody(playerId);
    const desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(pos.x, pos.y + 0.9, pos.z);
    const body = this.world.createRigidBody(desc);
    const cd = RAPIER.ColliderDesc.capsule(0.5, 0.4)
      .setCollisionGroups(GROUPS_BODY_COLLIDER)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = this.world.createCollider(cd, body);
    this.bodies.set(playerId, { body, collider });
    this.colliderToPlayerBody.set(collider.handle, playerId);
    return body;
  }

  detachBody(playerId: number) {
    const b = this.bodies.get(playerId);
    if (!b) return;
    this.colliderToPlayerBody.delete(b.collider.handle);
    this.world.removeRigidBody(b.body);
    this.bodies.delete(playerId);
  }

  setBodyPos(playerId: number, pos: Vec3) {
    const b = this.bodies.get(playerId);
    if (!b) return;
    b.body.setNextKinematicTranslation({ x: pos.x, y: pos.y + 0.9, z: pos.z });
  }

  attachTorso(playerId: number, pos: Vec3) {
    if (this.torsos.has(playerId)) this.detachTorso(playerId);
    const b = this.bodies.get(playerId);
    if (!b) return null;
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y + 1.10, pos.z)
      .setLinearDamping(4.0)
      .setAngularDamping(8.0);
    const torso = this.world.createRigidBody(desc);
    const cd = RAPIER.ColliderDesc.cuboid(0.30, 0.30, 0.18)
      .setDensity(60)
      .setCollisionGroups(0);
    this.world.createCollider(cd, torso);
    const params = RAPIER.JointData.spherical(
      { x: 0, y: -0.10, z: 0 },
      { x: 0, y: -0.30, z: 0 },
    );
    const joint = this.world.createImpulseJoint(params, b.body, torso, true);
    this.torsos.set(playerId, { body: torso, joint });
    return torso;
  }

  detachTorso(playerId: number) {
    const t = this.torsos.get(playerId);
    if (!t) return;
    if (t.joint) this.world.removeImpulseJoint(t.joint, true);
    this.world.removeRigidBody(t.body);
    this.torsos.delete(playerId);
  }

  driveTorso(playerId: number, dt = 1 / 30) {
    const t = this.torsos.get(playerId);
    if (!t) return;
    const r = t.body.rotation();
    const ax = -r.x * 60, ay = -r.y * 60, az = -r.z * 60;
    const m = t.body.mass() || 1;
    t.body.applyTorqueImpulse({ x: ax * m * dt, y: ay * m * dt, z: az * m * dt }, true);
  }

  torsoState(playerId: number) {
    const t = this.torsos.get(playerId);
    if (!t) return null;
    const rot = t.body.rotation();
    return { rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w } };
  }

  attachHead(playerId: number, pos: Vec3) {
    if (this.heads.has(playerId)) this.detachHead(playerId);
    const torso = this.torsos.get(playerId);
    if (!torso) return null;
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y + 1.55, pos.z)
      .setLinearDamping(3.0)
      .setAngularDamping(6.0);
    const head = this.world.createRigidBody(desc);
    const cd = RAPIER.ColliderDesc.ball(0.18)
      .setDensity(40)
      .setCollisionGroups(0);
    this.world.createCollider(cd, head);
    const params = RAPIER.JointData.spherical(
      { x: 0, y: 0.30, z: 0 },
      { x: 0, y: -0.18, z: 0 },
    );
    const joint = this.world.createImpulseJoint(params, torso.body, head, true);
    this.heads.set(playerId, { body: head, joint });
    return head;
  }

  detachHead(playerId: number) {
    const h = this.heads.get(playerId);
    if (!h) return;
    if (h.joint) this.world.removeImpulseJoint(h.joint, true);
    this.world.removeRigidBody(h.body);
    this.heads.delete(playerId);
  }

  driveHead(playerId: number, dt = 1 / 30) {
    const h = this.heads.get(playerId);
    if (!h) return;
    const r = h.body.rotation();
    const ax = -r.x * 32, ay = -r.y * 32, az = -r.z * 32;
    const m = h.body.mass() || 1;
    h.body.applyTorqueImpulse({ x: ax * m * dt, y: ay * m * dt, z: az * m * dt }, true);
  }

  headState(playerId: number) {
    const h = this.heads.get(playerId);
    if (!h) return null;
    const r = h.body.rotation();
    return { rot: { x: r.x, y: r.y, z: r.z, w: r.w } };
  }

  attachSword(playerId: number, weaponMass: number, length: number, startPos = { x: 0, y: 1.4, z: 0 }) {
    if (this.swords.has(playerId)) this.detachSword(playerId);
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(startPos.x, startPos.y, startPos.z)
      .setLinearDamping(2.0)
      .setAngularDamping(2.0)
      .setGravityScale(0)
      .setCcdEnabled(true);
    const body = this.world.createRigidBody(desc);
    const radius = 0.05;
    const halfLen = Math.max(0.05, length / 2 - radius);
    const cd = RAPIER.ColliderDesc.capsule(halfLen, radius)
      .setDensity(weaponMass * 220)
      .setRestitution(0.05)
      .setFriction(0.4)
      .setCollisionGroups(GROUPS_SWORD_COLLIDER)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = this.world.createCollider(cd, body);
    this.swords.set(playerId, { body, collider, weaponMass, length });
    this.colliderToPlayerSword.set(collider.handle, playerId);
    return body;
  }

  detachSword(playerId: number) {
    const sw = this.swords.get(playerId);
    if (!sw) return;
    if (sw.collider) this.colliderToPlayerSword.delete(sw.collider.handle);
    this.world.removeRigidBody(sw.body);
    this.swords.delete(playerId);
  }

  driveSword(playerId: number, target: Vec3, dt = 1 / 30) {
    const sw = this.swords.get(playerId);
    if (!sw) return;
    const t = sw.body.translation();
    const v = sw.body.linvel();
    const wMass = sw.weaponMass;
    const bodyMass = sw.body.mass() || wMass;
    const k = 380 / wMass;
    const d = 18;
    const ax = (target.x - t.x) * k - v.x * d;
    const ay = (target.y - t.y) * k - v.y * d;
    const az = (target.z - t.z) * k - v.z * d;
    const im = bodyMass * dt;
    const impX = ax * im, impY = ay * im, impZ = az * im;
    sw.body.applyImpulse({ x: impX, y: impY, z: impZ }, true);

    const torso = this.torsos.get(playerId);
    if (torso) {
      const tt = torso.body.translation();
      const gx = (t.x + tt.x) * 0.5;
      const gy = (t.y + tt.y) * 0.5;
      const gz = (t.z + tt.z) * 0.5;
      torso.body.applyImpulseAtPoint(
        { x: -impX * 0.45, y: -impY * 0.45, z: -impZ * 0.45 },
        { x: gx, y: gy, z: gz }, true,
      );
    }
  }

  step() {
    this._contacts.clear();
    if (this._clashes.length > 64) this._clashes.length = 0;
    this.world.step(this.eventQueue);
    this.eventQueue.drainCollisionEvents((h1: number, h2: number, started: boolean) => {
      if (!started) return;
      const sw1 = this.colliderToPlayerSword.get(h1);
      const sw2 = this.colliderToPlayerSword.get(h2);
      const bd1 = this.colliderToPlayerBody.get(h1);
      const bd2 = this.colliderToPlayerBody.get(h2);
      if (sw1 != null && bd2 != null && sw1 !== bd2) this._stampContact(sw1, bd2);
      if (sw2 != null && bd1 != null && sw2 !== bd1) this._stampContact(sw2, bd1);
      if (sw1 != null && sw2 != null && sw1 !== sw2) this._stampClash(sw1, sw2);
      if (sw1 != null && this.wallColliders.has(h2)) this._stampWallClash(sw1);
      if (sw2 != null && this.wallColliders.has(h1)) this._stampWallClash(sw2);
    });
  }

  _stampContact(attackerId: number, victimId: number) {
    const sw = this.swords.get(attackerId);
    if (!sw) return;
    const v = sw.body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    let m = this._contacts.get(attackerId);
    if (!m) { m = new Map(); this._contacts.set(attackerId, m); }
    const prev = m.get(victimId) || 0;
    if (speed > prev) m.set(victimId, speed);
  }

  _stampWallClash(swordPid: number) {
    const sw = this.swords.get(swordPid);
    if (!sw) return;
    const v = sw.body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    if (speed < 4) return;
    const t = sw.body.translation();
    this._wallClashes.push({ id: swordPid, speed, pos: { x: t.x, y: t.y, z: t.z } });
  }

  _stampClash(a: number, b: number) {
    const sa = this.swords.get(a), sb = this.swords.get(b);
    if (!sa || !sb) return;
    const va = sa.body.linvel(), vb = sb.body.linvel();
    const sp = Math.hypot(va.x - vb.x, va.y - vb.y, va.z - vb.z);
    this._clashes.push({ a, b, speed: sp });
  }

  drainContacts() {
    const out: { attackerId: number; victimId: number; speed: number }[] = [];
    for (const [attackerId, vmap] of this._contacts) {
      for (const [victimId, speed] of vmap) out.push({ attackerId, victimId, speed });
    }
    return out;
  }

  drainPhysicsClashes() {
    const out = this._clashes;
    this._clashes = [];
    return out;
  }

  drainWallClashes() {
    const out = this._wallClashes;
    this._wallClashes = [];
    return out;
  }

  swordState(playerId: number) {
    const sw = this.swords.get(playerId);
    if (!sw) return null;
    const t = sw.body.translation();
    const v = sw.body.linvel();
    return { pos: { x: t.x, y: t.y, z: t.z }, vel: { x: v.x, y: v.y, z: v.z }, length: sw.length };
  }

  setSwordGravity(playerId: number, on: boolean) {
    const sw = this.swords.get(playerId);
    if (!sw) return;
    sw.body.setGravityScale(on ? 1 : 0, true);
  }

  spawnArenaStatics({ size, wallH, pillars }: { size: number; wallH: number; pillars: { x: number; z: number; hx: number; hz: number }[] }) {
    const halfS = size / 2;
    const wallThick = 0.5;
    const wallSpecs = [
      { x: 0, z: -halfS, sx: size + wallThick * 2, sz: wallThick },
      { x: 0, z:  halfS, sx: size + wallThick * 2, sz: wallThick },
      { x: -halfS, z: 0, sx: wallThick, sz: size },
      { x:  halfS, z: 0, sx: wallThick, sz: size },
    ];
    const fixedDesc = RAPIER.RigidBodyDesc.fixed();
    for (const w of wallSpecs) {
      const body = this.world.createRigidBody(fixedDesc);
      const cd = RAPIER.ColliderDesc.cuboid(w.sx / 2, wallH / 2, w.sz / 2)
        .setTranslation(w.x, wallH / 2, w.z)
        .setRestitution(0.15).setFriction(0.6)
        .setCollisionGroups((0x0001 << 16) | (0x0001 | 0x0002))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      const col = this.world.createCollider(cd, body);
      this.wallColliders.add(col.handle);
    }
    for (const p of pillars || []) {
      const body = this.world.createRigidBody(fixedDesc);
      const cd = RAPIER.ColliderDesc.cuboid(p.hx, wallH * 0.45, p.hz)
        .setTranslation(p.x, wallH * 0.45, p.z)
        .setRestitution(0.15).setFriction(0.6)
        .setCollisionGroups((0x0001 << 16) | (0x0001 | 0x0002))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      const col = this.world.createCollider(cd, body);
      this.wallColliders.add(col.handle);
    }
  }

  spawnArenaProps(positions: Vec3[]) {
    for (const p of positions) {
      const radius = 0.45, height = 0.95;
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y + height / 2, p.z)
        .setLinearDamping(0.7).setAngularDamping(0.9);
      const body = this.world.createRigidBody(desc);
      const cd = RAPIER.ColliderDesc.cylinder(height / 2, radius)
        .setDensity(80)
        .setFriction(0.95)
        .setCollisionGroups((GROUP_BODY << 16) | (GROUP_BODY | GROUP_SWORD));
      this.world.createCollider(cd, body);
      this.props.push({ body });
    }
  }

  propsState() {
    const out: { pos: Vec3; rot: { x: number; y: number; z: number; w: number } }[] = [];
    for (const p of this.props) {
      const t = p.body.translation();
      const r = p.body.rotation();
      out.push({ pos: { x: t.x, y: t.y, z: t.z }, rot: { x: r.x, y: r.y, z: r.z, w: r.w } });
    }
    return out;
  }

  pushTorso(playerId: number, impulse: Vec3) {
    const t = this.torsos.get(playerId);
    if (!t) return;
    t.body.applyImpulse(impulse, true);
  }

  resetSwordPos(playerId: number, pos: Vec3) {
    const sw = this.swords.get(playerId);
    if (!sw) return;
    sw.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    sw.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    sw.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  resetRagPos(playerId: number, pos: Vec3) {
    const t = this.torsos.get(playerId);
    if (t) {
      t.body.setTranslation({ x: pos.x, y: pos.y + 1.10, z: pos.z }, true);
      t.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      t.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      t.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    const h = this.heads.get(playerId);
    if (h) {
      h.body.setTranslation({ x: pos.x, y: pos.y + 1.55, z: pos.z }, true);
      h.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      h.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      h.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }

  swapWeapon(playerId: number, newMass: number, newLength: number) {
    const sw = this.swords.get(playerId);
    if (!sw) return null;
    const at = sw.body.translation();
    this.detachSword(playerId);
    return this.attachSword(playerId, newMass, newLength, at);
  }
}