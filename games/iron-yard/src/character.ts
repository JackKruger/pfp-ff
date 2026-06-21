import * as THREE from "three";
import { CONFIG, type WeaponKey } from "./config";

const WEAPON_VISUAL: Record<string, { gripLen: number; bladeLen: number; bladeW: number; bladeT: number; guardW: number; head: string; color: number }> = {
  arming:      { gripLen: 0.20, bladeLen: 0.95, bladeW: 0.075, bladeT: 0.022, guardW: 0.30, head: "blade", color: 0xdfe5ee },
  longsword:   { gripLen: 0.34, bladeLen: 1.05, bladeW: 0.075, bladeT: 0.024, guardW: 0.36, head: "blade", color: 0xdfe5ee },
  mace:        { gripLen: 0.60, bladeLen: 0.28, bladeW: 0.14,  bladeT: 0.14,  guardW: 0.12, head: "ball",  color: 0x9a7a3a },
  spear:       { gripLen: 1.90, bladeLen: 0.28, bladeW: 0.05,  bladeT: 0.05,  guardW: 0.0,  head: "spear", color: 0xdfe5ee },
  swordshield: { gripLen: 0.20, bladeLen: 0.92, bladeW: 0.075, bladeT: 0.022, guardW: 0.30, head: "blade", color: 0xdfe5ee },
};

interface CharAnimState {
  walkPhase: number;
  swayPhase: number;
  recoilT: number;
  leanZ: number;
  leanX: number;
}

export interface CharacterRig {
  root: THREE.Group;
  weaponRig: THREE.Group;
  sword: THREE.Group;
  tipNode: THREE.Object3D;
  trail: THREE.Line;
  trailGeo: THREE.BufferGeometry;
  trailMat: THREE.LineBasicMaterial;
  trailPts: Float32Array;
  trailState: { count: number; idx: number; lastTipWorld: THREE.Vector3 };
  parts: {
    torso: THREE.Mesh;
    head: THREE.Mesh;
    helm: THREE.Group;
    legL: THREE.Group;
    legR: THREE.Group;
    armL: THREE.Group;
    weaponRig: THREE.Group;
    hips: THREE.Mesh;
    elbowL: THREE.Group;
    elbowR: THREE.Group;
    shinL: THREE.Group;
    shinR: THREE.Group;
    footL: THREE.Group;
    footR: THREE.Group;
    // Extra meshes for invuln pulse
    legLMesh: THREE.Mesh;
    legRMesh: THREE.Mesh;
    shinLMesh: THREE.Mesh;
    shinRMesh: THREE.Mesh;
    footLMesh: THREE.Mesh;
    footRMesh: THREE.Mesh;
    upperArmLMesh: THREE.Mesh;
    upperArmRMesh: THREE.Mesh;
    forearmLMesh: THREE.Mesh;
    forearmRMesh: THREE.Mesh;
    handLMesh: THREE.Mesh;
    handRMesh: THREE.Mesh;
    helmDome: THREE.Mesh;
    visor: THREE.Mesh;
    abdomen: THREE.Mesh;
    gorget: THREE.Mesh;
    pauldronL: THREE.Mesh;
    pauldronR: THREE.Mesh;
    shieldMesh?: THREE.Mesh;
  };
  animate(dt: number, opts: AnimationOptions): void;
  setInvuln(active: boolean, t: number): void;
  pushTrail(tipWorld: THREE.Vector3, tipSpeed: number): void;
  swapWeapon(weaponKey: string): void;
  setGrip(grip: string): void;
}

interface AnimationOptions {
  mvSpeed?: number;
  swinging?: boolean;
  blocking?: boolean;
  alive?: boolean;
  swingLat?: number;
  swingFwd?: number;
  crippled?: boolean;
  stunned?: boolean;
  verAim?: number;
  tipDist?: number;
  torsoRot?: { x: number; y: number; z: number; w: number } | null;
  headRot?: { x: number; y: number; z: number; w: number } | null;
  playerYaw?: number;
  attackT?: number;
  attackType?: string | null;
  grip?: string;
}

function makePlateTexture(baseHex: number) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const r = (baseHex >> 16) & 0xff, g = (baseHex >> 8) & 0xff, b = baseHex & 0xff;
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, `rgb(${Math.min(255, r + 18)},${Math.min(255, g + 18)},${Math.min(255, b + 18)})`);
  grad.addColorStop(1, `rgb(${Math.max(0, r - 22)},${Math.max(0, g - 22)},${Math.max(0, b - 22)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.10 + Math.random() * 0.15})`;
    ctx.beginPath(); ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMailTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#3a3a42";
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 4) {
    const off = (y / 4) % 2 === 0 ? 0 : 2;
    for (let x = off; x < size; x += 4) {
      ctx.fillStyle = "#5e5e68"; ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = "#1f1f25"; ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildWeaponMesh(key: string) {
  const w = WEAPON_VISUAL[key] ?? WEAPON_VISUAL.arming;
  const sword = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: w.color, metalness: 0.85, roughness: 0.25 });
  const gripMat  = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.95 });
  const guardMat = new THREE.MeshStandardMaterial({ color: 0x9a7a3a, metalness: 0.7, roughness: 0.4 });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, w.gripLen, 8), gripMat);
  grip.position.y = w.gripLen / 2; sword.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), guardMat);
  pommel.position.y = 0; sword.add(pommel);
  if (w.guardW > 0) {
    const guard = new THREE.Mesh(new THREE.BoxGeometry(w.guardW, 0.025, 0.04), guardMat);
    guard.position.y = w.gripLen; sword.add(guard);
  }
  if (w.head === "blade") {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(w.bladeW, w.bladeLen, w.bladeT), bladeMat);
    blade.position.y = w.gripLen + w.bladeLen / 2; sword.add(blade);
  } else if (w.head === "ball") {
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(w.bladeW, 1),
      new THREE.MeshStandardMaterial({ color: w.color, metalness: 0.4, roughness: 0.6 }));
    ball.position.y = w.gripLen + w.bladeW; sword.add(ball);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 4),
        new THREE.MeshStandardMaterial({ color: 0xbcc1cc, metalness: 0.7, roughness: 0.3 }));
      s.position.set(Math.cos(a) * w.bladeW, w.gripLen + w.bladeW, Math.sin(a) * w.bladeW);
      sword.add(s);
    }
  } else if (w.head === "spear") {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, w.bladeLen, 8), bladeMat);
    tip.position.y = w.gripLen + w.bladeLen / 2; sword.add(tip);
  }
  return sword;
}

function buildShield(): THREE.Mesh {
  const shield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.45, 0.06, 16, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x7a4a30, roughness: 0.85 }),
  );
  shield.rotation.x = Math.PI / 2;
  shield.rotation.z = Math.PI;
  const boss = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x9a7a3a, metalness: 0.7, roughness: 0.4 }),
  );
  boss.position.set(0, 0, 0.05);
  shield.add(boss);
  return shield;
}

export function buildCharacter(
  options: { color?: number; weaponKey?: string; grip?: string; isLocal?: boolean } = {},
): CharacterRig {
  const color = options.color ?? 0x9aa0a8;
  const weaponKey = options.weaponKey ?? "arming";
  const isLocal = options.isLocal ?? false;

  const root = new THREE.Group();
  const skinMat   = new THREE.MeshStandardMaterial({ color: 0xc8997a, roughness: 0.9 });
  const plateTex  = makePlateTexture(color);
  const plateMat  = new THREE.MeshStandardMaterial({ map: plateTex, color: 0xffffff, roughness: 0.45, metalness: 0.55 });
  const mailTex   = makeMailTexture();
  const mailMat   = new THREE.MeshStandardMaterial({ map: mailTex, color: 0x6a6a72, roughness: 0.55, metalness: 0.7 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.95 });
  const goldMat    = new THREE.MeshStandardMaterial({ color: 0x9a7a3a, metalness: 0.7, roughness: 0.4 });

  const radius = CONFIG.PLAYER.radius;
  const height = CONFIG.PLAYER.height;
  const Y_HIP        = height * 0.50;
  const Y_PELVIS_TOP = height * 0.55;
  const Y_ABDOMEN    = height * 0.62;
  const Y_CHEST      = height * 0.72;
  const Y_SHOULDER   = height * 0.83;
  const Y_NECK       = height * 0.92;
  const Y_HEAD       = height * 0.98;
  const UPPER_ARM_LEN = height * 0.20;
  const FOREARM_LEN   = height * 0.22;
  const THIGH_LEN     = height * 0.25;
  const SHIN_LEN      = height * 0.23;

  // Pelvis
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius * 0.62, height * 0.13, 14), plateMat);
  pelvis.position.y = Y_PELVIS_TOP - height * 0.065; pelvis.castShadow = true; root.add(pelvis);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, height * 0.045, 18), leatherMat);
  belt.position.y = Y_PELVIS_TOP - height * 0.005; root.add(belt);

  // Legs
  let legLMesh: THREE.Mesh, legRMesh: THREE.Mesh, shinLMesh: THREE.Mesh, shinRMesh: THREE.Mesh;
  let footLMesh: THREE.Mesh, footRMesh: THREE.Mesh;

  function buildLeg(side: string) {
    const sx = side === "L" ? -1 : 1;
    const thigh = new THREE.Group();
    thigh.position.set(sx * radius * 0.30, Y_HIP - height * 0.02, 0);
    const thighM = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.28, radius * 0.24, THIGH_LEN, 12), mailMat);
    thighM.position.y = -THIGH_LEN / 2; thighM.castShadow = true; thigh.add(thighM);
    const knee = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.25, 1), plateMat);
    knee.position.y = -THIGH_LEN; thigh.add(knee);
    const shin = new THREE.Group();
    shin.position.y = -THIGH_LEN; thigh.add(shin);
    const shinM = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.22, radius * 0.16, SHIN_LEN, 12), plateMat);
    shinM.position.y = -SHIN_LEN / 2; shinM.castShadow = true; shin.add(shinM);
    const foot = new THREE.Group();
    foot.position.y = -SHIN_LEN; shin.add(foot);
    const footM = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.42, radius * 0.18, radius * 0.62), leatherMat);
    footM.position.set(0, -radius * 0.05, radius * 0.10); footM.castShadow = true; foot.add(footM);
    if (side === "L") { legLMesh = thighM; shinLMesh = shinM; footLMesh = footM; }
    else { legRMesh = thighM; shinRMesh = shinM; footRMesh = footM; }
    return { thigh, shin, foot };
  }
  const legL = buildLeg("L"), legR = buildLeg("R");
  root.add(legL.thigh, legR.thigh);

  // Torso
  const abdomen = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.78, height * 0.12, 14), mailMat);
  abdomen.position.y = Y_ABDOMEN; abdomen.castShadow = true; root.add(abdomen);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius * 0.74, height * 0.28, 14), plateMat);
  torso.position.y = Y_CHEST + height * 0.02; torso.castShadow = true; root.add(torso);
  const gorget = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.42, radius * 0.55, height * 0.06, 14), plateMat);
  gorget.position.y = Y_SHOULDER - height * 0.03; root.add(gorget);
  // Pauldrons
  const pauldronGeo = new THREE.SphereGeometry(radius * 0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const pauldronL = new THREE.Mesh(pauldronGeo, plateMat);
  pauldronL.position.set(-radius * 0.95, Y_SHOULDER + radius * 0.05, 0); root.add(pauldronL);
  const pauldronR = new THREE.Mesh(pauldronGeo, plateMat);
  pauldronR.position.set( radius * 0.95, Y_SHOULDER + radius * 0.05, 0); root.add(pauldronR);

  // Head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.24, radius * 0.27, height * 0.07, 10), skinMat);
  neck.position.y = Y_NECK - height * 0.025; root.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.50, 16, 14), skinMat);
  head.position.y = Y_HEAD; head.castShadow = true; root.add(head);
  const helm = new THREE.Group();
  helm.position.y = Y_HEAD; root.add(helm);
  const helmDome = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.58, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), plateMat);
  helmDome.position.y = 0; helmDome.castShadow = true; helm.add(helmDome);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.85, radius * 0.55, radius * 0.05), plateMat);
  visor.position.set(0, -radius * 0.05, -radius * 0.45); helm.add(visor);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.55, radius * 0.06, radius * 0.06),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 }));
  slit.position.set(0, radius * 0.10, -radius * 0.48); helm.add(slit);

  // Left arm
  const armL = new THREE.Group();
  armL.position.set(-radius * 0.95, Y_SHOULDER, 0); root.add(armL);
  const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.22, radius * 0.20, UPPER_ARM_LEN, 10), mailMat);
  upperArmL.position.y = -UPPER_ARM_LEN / 2; upperArmL.castShadow = true; armL.add(upperArmL);
  const couterL = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.22, 1), plateMat);
  couterL.position.y = -UPPER_ARM_LEN; armL.add(couterL);
  const elbowL = new THREE.Group();
  elbowL.position.y = -UPPER_ARM_LEN; armL.add(elbowL);
  const forearmL = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.20, radius * 0.18, FOREARM_LEN, 10), plateMat);
  forearmL.position.y = -FOREARM_LEN / 2; forearmL.castShadow = true; elbowL.add(forearmL);
  const handL = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.30, radius * 0.22, radius * 0.32), plateMat);
  handL.position.y = -FOREARM_LEN - radius * 0.05; elbowL.add(handL);
  elbowL.rotation.x = 0.30;

  // Right arm (weapon)
  const weaponRig = new THREE.Group();
  weaponRig.position.set(radius * 0.95, Y_SHOULDER, 0); root.add(weaponRig);
  const upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.22, radius * 0.20, UPPER_ARM_LEN, 10), mailMat);
  upperArmR.position.y = -UPPER_ARM_LEN / 2; upperArmR.castShadow = true; weaponRig.add(upperArmR);
  const couterR = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.22, 1), plateMat);
  couterR.position.y = -UPPER_ARM_LEN; weaponRig.add(couterR);
  const elbowR = new THREE.Group();
  elbowR.position.y = -UPPER_ARM_LEN; weaponRig.add(elbowR);
  const forearmR = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.20, radius * 0.18, FOREARM_LEN, 10), plateMat);
  forearmR.position.y = -FOREARM_LEN / 2; forearmR.castShadow = true; elbowR.add(forearmR);
  const handR = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.32, radius * 0.24, radius * 0.34), plateMat);
  handR.position.y = -FOREARM_LEN - radius * 0.06; elbowR.add(handR);
  elbowR.rotation.x = 0.35;

  // Sword
  const sword = buildWeaponMesh(weaponKey);
  sword.position.set(0, -(UPPER_ARM_LEN + FOREARM_LEN), 0);
  sword.rotation.x = Math.PI;
  weaponRig.add(sword);
  const tipNode = new THREE.Object3D();
  const wv = WEAPON_VISUAL[weaponKey] ?? WEAPON_VISUAL.arming;
  tipNode.position.y = wv.gripLen + wv.bladeLen;
  sword.add(tipNode);
  const SWORD_LEN = wv.gripLen + wv.bladeLen;

  // Trail
  const TRAIL_COLOR: Record<string, number> = {
    arming: 0xfff0c0, longsword: 0xfff0c0, mace: 0xff9050, spear: 0xa8e6ff, swordshield: 0xfff0c0,
  };
  const trailPts = new Float32Array(22 * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPts, 3));
  trailGeo.setDrawRange(0, 0);
  const trailMat = new THREE.LineBasicMaterial({ color: TRAIL_COLOR[weaponKey] ?? 0xfff0c0, transparent: true, opacity: 0 });
  const trail = new THREE.Line(trailGeo, trailMat);
  trail.frustumCulled = false;
  root.add(trail);

  if (isLocal) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.7, 32),
      new THREE.MeshBasicMaterial({ color: 0xc8a97e, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; root.add(ring);
  }

  const anim: CharAnimState = { walkPhase: 0, swayPhase: 0, recoilT: 0, leanZ: 0, leanX: 0 };
  const trailState = { count: 0, idx: 0, lastTipWorld: new THREE.Vector3() };
  const _twoHand = { grip: new THREE.Vector3(), target: new THREE.Vector3() };

  // Shield mesh (created lazily)
  let _shieldMesh: THREE.Mesh | undefined;

  const rig: CharacterRig = {
    root, weaponRig, sword, tipNode, trail, trailGeo, trailMat, trailPts, trailState,
    parts: {
      torso, head, helm, legL: legL.thigh, legR: legR.thigh,
      armL, weaponRig, hips: pelvis,
      elbowL, elbowR, shinL: legL.shin, shinR: legR.shin,
      footL: legL.foot, footR: legR.foot,
      legLMesh: legLMesh!, legRMesh: legRMesh!,
      shinLMesh: shinLMesh!, shinRMesh: shinRMesh!,
      footLMesh: footLMesh!, footRMesh: footRMesh!,
      upperArmLMesh: upperArmL, upperArmRMesh: upperArmR,
      forearmLMesh: forearmL, forearmRMesh: forearmR,
      handLMesh: handL, handRMesh: handR,
      helmDome, visor,
      abdomen, gorget, pauldronL, pauldronR,
    },
    animate(dt, opts) {
      const {
        mvSpeed = 0, swinging = false, blocking = false, alive = true,
        swingLat = 0, swingFwd = 0, crippled = false, stunned = false,
        verAim = 0, tipDist = 0, torsoRot = null, headRot = null,
        playerYaw = 0, attackT = -1, attackType = null, grip = "one-hand",
      } = opts;

      const lift = Math.max(-0.05, Math.min(0.20, verAim * 0.18));
      weaponRig.position.y = Y_SHOULDER + lift;
      pauldronR.position.y = Y_SHOULDER + radius * 0.05 + lift;

      // Elbow IK
      const A_ARM = UPPER_ARM_LEN;
      const B_ARM = FOREARM_LEN + SWORD_LEN;
      const minR = Math.abs(B_ARM - A_ARM) + 0.05;
      const maxR = A_ARM + B_ARM;
      const chord = Math.max(minR, Math.min(maxR, tipDist || maxR * 0.7));
      let cosAngle = (A_ARM * A_ARM + B_ARM * B_ARM - chord * chord) / (2 * A_ARM * B_ARM);
      cosAngle = Math.max(-1, Math.min(1, cosAngle));
      elbowR.rotation.x = Math.PI - Math.acos(cosAngle);

      anim.swayPhase += dt;

      if (alive) {
        const breath = (1 - Math.min(1, mvSpeed)) * 0.030 * Math.sin(anim.swayPhase * 1.6);
        torso.scale.y = 1 + breath;

        const stride = Math.max(0, Math.min(1, mvSpeed / 5));
        anim.walkPhase += dt * (4.6 + mvSpeed * 1.0) * stride;
        const phase = anim.walkPhase;
        const lSwing =  Math.sin(phase) * 0.95 * stride;
        const rSwing = -Math.sin(phase) * 0.95 * stride;
        legL.thigh.rotation.x = lSwing;
        legR.thigh.rotation.x = rSwing;
        legL.shin.rotation.x = Math.max(0.04, lSwing * 0.85);
        legR.shin.rotation.x = Math.max(0.04, rSwing * 0.85);
        legL.foot.rotation.x = -lSwing * 0.45;
        legR.foot.rotation.x = -rSwing * 0.45;
        root.position.y += (Math.abs(Math.sin(phase)) - 0.5) * 0.04 * stride;

        // Left arm — shield / two-hand / one-hand
        if (grip === "shield") {
          // Issue 16: Shield blocking arm pose
          armL.position.set(-radius * 0.80, Y_SHOULDER - height * 0.02, -radius * 0.25);
          armL.rotation.x = -0.60;
          armL.rotation.z = 0.35;
          elbowL.rotation.x = 1.20;
          // Create shield mesh if not present
          if (!_shieldMesh) {
            _shieldMesh = buildShield();
            _shieldMesh.name = "shieldMesh";
            _shieldMesh.position.set(0, -(UPPER_ARM_LEN + FOREARM_LEN) - 0.15, 0);
            armL.add(_shieldMesh);
          }
          if (blocking) {
            armL.rotation.x = -0.85;
            armL.rotation.z = 0.45;
            _shieldMesh.position.set(0, -(UPPER_ARM_LEN + FOREARM_LEN) - 0.10, 0.15);
          } else {
            _shieldMesh.position.set(0, -(UPPER_ARM_LEN + FOREARM_LEN) - 0.15, 0);
          }
        } else if (grip === "two-hand") {
          // Issue 17: Two-hand grip — left arm reaches across chest
          armL.position.set(-radius * 0.45, Y_SHOULDER - height * 0.04, radius * 0.35);
          const gripLocal = _twoHand.grip.set(0, -(UPPER_ARM_LEN + FOREARM_LEN), 0);
          weaponRig.localToWorld(gripLocal);
          root.worldToLocal(gripLocal);
          gripLocal.y -= 0.05; gripLocal.x -= 0.05;
          const targetVec = _twoHand.target.copy(gripLocal).sub(armL.position);
          const d = targetVec.length();
          if (d > 0.001) armL.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), targetVec.normalize());
          elbowL.rotation.x = 0.10 + Math.acos(Math.min(1, d / (UPPER_ARM_LEN + FOREARM_LEN))) * 0.55;
        } else {
          // One-hand: swing arm naturally
          armL.rotation.x = -Math.sin(phase) * 0.5 * stride;
          elbowL.rotation.x = 0.30 + Math.max(0, -Math.sin(phase) * 0.3 * stride);
        }

        if (crippled) {
          legR.thigh.rotation.z = 0.25; torso.rotation.z += 0.10;
        }

        if (stunned) {
          const wob = Math.sin(anim.swayPhase * 6.0) * 0.18;
          torso.rotation.z += wob;
          torso.rotation.x += Math.sin(anim.swayPhase * 5.0) * 0.10;
          legL.thigh.rotation.x = 0; legR.thigh.rotation.x = 0;
        }

        // Lean from swing
        const idleSway = Math.sin(anim.swayPhase * 1.2) * 0.02;
        anim.leanZ += (Math.max(-0.55, Math.min(0.55, swingLat * 0.10)) - anim.leanZ) * Math.min(1, dt * 14);
        anim.leanX += (Math.max(-0.45, Math.min(0.45, swingFwd * 0.08)) - anim.leanX) * Math.min(1, dt * 14);
        torso.rotation.z = idleSway + anim.leanZ;
        torso.rotation.x = anim.leanX;

        if (torsoRot) {
          const cy = Math.cos(-playerYaw), sy = Math.sin(-playerYaw);
          torso.rotation.x += Math.max(-0.18, Math.min(0.18, (cy * torsoRot.x + sy * torsoRot.z) * 0.7));
          torso.rotation.z += Math.max(-0.18, Math.min(0.18, (-sy * torsoRot.x + cy * torsoRot.z) * 0.7));
        }
        if (headRot) {
          const cy = Math.cos(-playerYaw), sy = Math.sin(-playerYaw);
          head.rotation.x = Math.max(-0.20, Math.min(0.20, (cy * headRot.x + sy * headRot.z) * 0.6));
          head.rotation.z = Math.max(-0.20, Math.min(0.20, (-sy * headRot.x + cy * headRot.z) * 0.6));
          helm.rotation.x = head.rotation.x; helm.rotation.z = head.rotation.z;
        }

        pelvis.rotation.y = -anim.leanZ * 1.6;
        pelvis.rotation.x = -anim.leanX * 0.6;
        const stagger = Math.max(-0.3, Math.min(0.3, anim.leanZ * 1.2));
        legL.thigh.position.z = stagger * 0.30;
        legR.thigh.position.z = -stagger * 0.30;

        if (blocking && grip !== "shield") {
          torso.rotation.x += 0.10;
          armL.rotation.x = 0.6; elbowL.rotation.x = 0.9;
        }

        // Attack body anim (Issue 15)
        if (attackT >= 0 && attackT <= 1) {
          let crouch = 0, surge = 0, spineBend = 0;
          if (attackT < 0.30) {
            const w = attackT / 0.30;
            crouch = -0.10 * Math.sin(w * Math.PI * 0.5);
            spineBend = -0.18 * w;
          } else if (attackT < 0.60) {
            const w = (attackT - 0.30) / 0.30;
            const arc = Math.sin(w * Math.PI);
            crouch = 0.05 * arc;
            surge  = 0.20 * arc;
            spineBend = 0.32 * arc;
          } else {
            const w = (attackT - 0.60) / 0.40;
            spineBend = 0.10 * (1 - w);
          }
          root.position.y += crouch;
          torso.rotation.x += surge + spineBend;
          pelvis.rotation.x += -spineBend * 0.4;

          if (attackType === "swing" || attackType === "swingR" || attackType === "swingL" || attackType === "overhead") {
            const dir = attackType === "swingL" || attackType === "swing" ? -1 : 1;
            const twist = attackT < 0.30
              ? -dir * 0.35 * (attackT / 0.30)
              : attackT < 0.60
                ? -dir * 0.35 + dir * 0.85 * ((attackT - 0.30) / 0.30)
                : dir * 0.50 * (1 - (attackT - 0.60) / 0.40);
            torso.rotation.y = twist;
            pelvis.rotation.y -= twist * 0.40;
          }
        }
      } else {
        // Death pose
        anim.recoilT = Math.min(1, anim.recoilT + dt * 4);
        const k = anim.recoilT;
        legL.thigh.rotation.x = -1.1 * k;
        legR.thigh.rotation.x = -0.9 * k;
        legL.shin.rotation.x  =  0.6 * k;
        legR.shin.rotation.x  =  0.5 * k;
        armL.rotation.x       =  0.4 * k;
        torso.rotation.x      = -0.9 * k;
      }
    },

    setInvuln(active, t) {
      const pulse = active ? (0.4 + 0.4 * Math.abs(Math.sin(t * 10))) : 1.0;
      // Issue 19: All meshes
      const meshes = [
        torso, abdomen, pelvis, gorget, neck, head, pauldronL, pauldronR,
        legLMesh, legRMesh, shinLMesh, shinRMesh, footLMesh, footRMesh,
        upperArmL, upperArmR, forearmL, forearmR, handL, handR,
        helmDome, visor,
      ];
      for (const m of meshes) {
        if (!m || !m.material) continue;
        (m.material as THREE.Material).transparent = active;
        (m.material as THREE.Material).opacity = pulse;
      }
    },

    pushTrail(tipWorld, tipSpeed) {
      const local = tipWorld.clone();
      root.worldToLocal(local);
      const tlen = trailPts.length / 3;
      for (let i = (trailState.count >= tlen ? tlen - 1 : trailState.count); i > 0; i--) {
        trailPts[i * 3 + 0] = trailPts[(i - 1) * 3 + 0];
        trailPts[i * 3 + 1] = trailPts[(i - 1) * 3 + 1];
        trailPts[i * 3 + 2] = trailPts[(i - 1) * 3 + 2];
      }
      trailPts[0] = local.x; trailPts[1] = local.y; trailPts[2] = local.z;
      if (trailState.count < tlen) trailState.count++;
      trailGeo.setDrawRange(0, trailState.count);
      trailGeo.attributes.position.needsUpdate = true;
      trailMat.opacity = Math.max(0, Math.min(0.85, (tipSpeed - 4) / 16));
    },

    swapWeapon(newKey) {
      // Remove old sword, add new one
      weaponRig.remove(sword);
      // Remove shield mesh if present
      if (_shieldMesh) {
        armL.remove(_shieldMesh);
        _shieldMesh = undefined;
      }
      const newSword = buildWeaponMesh(newKey);
      newSword.position.set(0, -(UPPER_ARM_LEN + FOREARM_LEN), 0);
      newSword.rotation.x = Math.PI;
      weaponRig.add(newSword);

      const wv2 = WEAPON_VISUAL[newKey] ?? WEAPON_VISUAL.arming;
      tipNode.position.y = wv2.gripLen + wv2.bladeLen;
      const TRAIL_COLOR2: Record<string, number> = {
        arming: 0xfff0c0, longsword: 0xfff0c0, mace: 0xff9050,
        spear: 0xa8e6ff, swordshield: 0xfff0c0,
      };
      trailMat.color.setHex(TRAIL_COLOR2[newKey] ?? 0xfff0c0);
      trailState.count = 0;
      trailGeo.setDrawRange(0, 0);
    },

    setGrip(grip) {
      if (grip === "shield" && !_shieldMesh) {
        _shieldMesh = buildShield();
        _shieldMesh.name = "shieldMesh";
        _shieldMesh.position.set(0, -(UPPER_ARM_LEN + FOREARM_LEN) - 0.15, 0);
        armL.add(_shieldMesh);
      } else if (grip !== "shield" && _shieldMesh) {
        armL.remove(_shieldMesh);
        _shieldMesh = undefined;
      }
    },
  };

  return rig;
}