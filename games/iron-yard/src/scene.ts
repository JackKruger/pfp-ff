import * as THREE from "three";
import { CONFIG } from "./config";

function noiseTexture({ size = 256, base = [0x6a, 0x55, 0x36] } = {}) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = (Math.sin(x * 0.13) + Math.cos(y * 0.17) + Math.sin((x + y) * 0.09)) * 0.33;
      const m = Math.random() * 24 - 12 + n * 12;
      const i = (y * size + x) * 4;
      img.data[i + 0] = Math.max(0, Math.min(255, base[0] + m));
      img.data[i + 1] = Math.max(0, Math.min(255, base[1] + m));
      img.data[i + 2] = Math.max(0, Math.min(255, base[2] + m));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function stoneBrickTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2c241c";
  ctx.fillRect(0, 0, size, size);
  const rowH = 32, brickW = 64;
  for (let y = 0; y < size; y += rowH) {
    const off = ((y / rowH) % 2) * (brickW / 2);
    for (let x = -brickW; x < size + brickW; x += brickW) {
      const grey = 60 + Math.floor(Math.random() * 35);
      ctx.fillStyle = `rgb(${grey + 15},${grey + 8},${grey})`;
      ctx.fillRect(x + off + 1, y + 1, brickW - 2, rowH - 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function dirtTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#5a4530";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(40,28,18,0.4)" : "rgba(120,95,65,0.35)";
    ctx.beginPath(); ctx.arc(x, y, 1 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14110d);
  scene.fog = new THREE.Fog(0x14110d, 25, 70);

  const sun = new THREE.DirectionalLight(0xffe1b0, 1.4);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -25; sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 25;   sun.shadow.camera.bottom = -25;
  sun.shadow.camera.near = 1;   sun.shadow.camera.far = 80;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x556677, 0x2a1f15, 0.45));
  scene.add(new THREE.AmbientLight(0x111111, 0.4));

  const size = CONFIG.ARENA.size;
  const groundGeo = new THREE.PlaneGeometry(size, size, 16, 16);
  const groundTex = dirtTexture();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
    map: groundTex, color: 0xffffff, roughness: 1,
  }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const wallH = CONFIG.ARENA.wallH;
  const wallTex = stoneBrickTexture();
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0xffffff, roughness: 0.95 });
  const halfS = size / 2;
  const wallThick = 0.5;
  const wallSpecs = [
    { x: 0, z: -halfS, sx: size + wallThick * 2, sz: wallThick },
    { x: 0, z:  halfS, sx: size + wallThick * 2, sz: wallThick },
    { x: -halfS, z: 0, sx: wallThick, sz: size },
    { x:  halfS, z: 0, sx: wallThick, sz: size },
  ];
  for (const w of wallSpecs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.sx, wallH, w.sz), wallMat);
    m.position.set(w.x, wallH / 2, w.z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }

  const grid = new THREE.GridHelper(size, size / 2, 0x2a1f12, 0x2a1f12);
  grid.position.y = 0.01;
  scene.add(grid);

  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc8a97e, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
  const ringGeo = new THREE.RingGeometry(0.8, 1.0, 32);
  const r = halfS - 2;
  for (const [cx, cz] of [[-r, -r], [r, -r], [r, r], [-r, r]]) {
    const m = new THREE.Mesh(ringGeo, ringMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0.02, cz);
    scene.add(m);
  }

  // Weapon racks
  const rackPostMat = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.9 });
  const rackRingMat = new THREE.MeshBasicMaterial({ color: 0x9adfff, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdfe5ee, metalness: 0.85, roughness: 0.25 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.95 });
  const guardMat = new THREE.MeshStandardMaterial({ color: 0x9a7a3a, metalness: 0.7, roughness: 0.4 });
  const racks = [
    { x: -10, z:  0, weapon: "longsword" },
    { x:  10, z:  0, weapon: "mace" },
    { x:  0,  z: -10, weapon: "spear" },
    { x:  0,  z:  10, weapon: "arming" },
  ];
  for (const rk of racks) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 1.2, 6), rackPostMat);
    post.position.set(rk.x, 0.6, rk.z); post.castShadow = true; scene.add(post);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), rackRingMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(rk.x, 0.05, rk.z); scene.add(ring);
    const wgrp = new THREE.Group();
    wgrp.position.set(rk.x, 1.30, rk.z);
    if (rk.weapon === "mace") {
      const g = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), gripMat); g.position.y = 0.275;
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), guardMat); b.position.y = 0.65;
      wgrp.add(g); wgrp.add(b);
    } else if (rk.weapon === "spear") {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.85, 8), gripMat); s.position.y = 0.925;
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.25, 8), bladeMat); t.position.y = 1.975;
      wgrp.add(s); wgrp.add(t);
    } else {
      const len = rk.weapon === "longsword" ? 1.30 : 1.12;
      const g = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.20, 8), gripMat); g.position.y = 0.10;
      const gu = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.04), guardMat); gu.position.y = 0.20;
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.92, 0.012), bladeMat); bl.position.y = 0.20 + 0.46;
      wgrp.add(g); wgrp.add(gu); wgrp.add(bl);
    }
    scene.add(wgrp);
  }

  // Corner torches
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.85 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });
  const torchData: { flame: THREE.Mesh; light: THREE.PointLight; baseY: number; phase: number }[] = [];
  const cornerOff = halfS - 1.2;
  for (const [cx, cz] of [[-cornerOff, -cornerOff], [cornerOff, -cornerOff], [cornerOff, cornerOff], [-cornerOff, cornerOff]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), postMat);
    post.position.set(cx, 1.2, cz); post.castShadow = true; scene.add(post);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 8), flameMat);
    flame.position.set(cx, 2.55, cz); scene.add(flame);
    const light = new THREE.PointLight(0xffb050, 1.2, 14, 1.6);
    light.position.set(cx, 2.55, cz); scene.add(light);
    torchData.push({ flame, light, baseY: 2.55, phase: Math.random() * Math.PI * 2 });
  }

  return { scene, sun, torchData };
}