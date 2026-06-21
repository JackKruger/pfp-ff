import { CONFIG } from "./config";
import type { Vec3 } from "./math";

export interface SpawnPoint {
  pos: Vec3;
  yaw: number;
}

export interface WeaponRack {
  x: number;
  z: number;
  weapon: string;
}

export function spawnPoints(): SpawnPoint[] {
  const s = CONFIG.ARENA.size / 2 - 2;
  return [
    { pos: { x: -s, y: 0, z: -s }, yaw: Math.PI * 0.25 },
    { pos: { x:  s, y: 0, z: -s }, yaw: -Math.PI * 0.25 },
    { pos: { x:  s, y: 0, z:  s }, yaw: -Math.PI * 0.75 },
    { pos: { x: -s, y: 0, z:  s }, yaw: Math.PI * 0.75 },
  ];
}

export function weaponRacks() {
  return [
    { x: -10, z:  0, weapon: "longsword" },
    { x:  10, z:  0, weapon: "mace" },
    { x:  0,  z: -10, weapon: "spear" },
    { x:  0,  z:  10, weapon: "arming" },
  ];
}

export function obstacles(): { x: number; z: number; hx: number; hz: number }[] {
  return [];
}

export function clampToArena(pos: Vec3) {
  const half = CONFIG.ARENA.size / 2 - CONFIG.PLAYER.radius;
  if (pos.x < -half) pos.x = -half;
  if (pos.x >  half) pos.x =  half;
  if (pos.z < -half) pos.z = -half;
  if (pos.z >  half) pos.z =  half;
  for (const o of obstacles()) {
    const dx = pos.x - o.x;
    const dz = pos.z - o.z;
    const px = o.hx + CONFIG.PLAYER.radius - Math.abs(dx);
    const pz = o.hz + CONFIG.PLAYER.radius - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) pos.x += dx >= 0 ? px : -px;
      else pos.z += dz >= 0 ? pz : -pz;
    }
  }
  if (pos.y < 0) pos.y = 0;
}