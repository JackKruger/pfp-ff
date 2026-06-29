import Phaser from "phaser";

export const TEXTURES = {
  player: "raskulls-player",
  dirt: "raskulls-dirt",
  stone: "raskulls-stone",
  crate: "raskulls-crate",
  redBlock: "raskulls-block-red",
  blueBlock: "raskulls-block-blue",
  yellowBlock: "raskulls-block-yellow",
  greenBlock: "raskulls-block-green",
  grayBlock: "raskulls-block-gray",
  gem: "raskulls-gem",
  boostie: "raskulls-boostie",
  dash: "raskulls-dash",
  bomb: "raskulls-bomb",
  shield: "raskulls-shield",
  stunBolt: "raskulls-stun-bolt",
  burst: "raskulls-burst",
  spikes: "raskulls-spikes",
  finish: "raskulls-finish",
  // Per-variant player textures
  playerKing: "raskulls-player-king",
  playerNinja: "raskulls-player-ninja",
  playerDragon: "raskulls-player-dragon",
  playerWizard: "raskulls-player-wizard",
  playerPirat: "raskulls-player-pirat",
} as const;

export type CharacterVariant = "default" | "king" | "ninja" | "dragon" | "wizard" | "pirat";

const VARIANT_BY_SLOT: CharacterVariant[] = ["king", "ninja", "dragon", "wizard", "pirat", "default"];

export function variantForSlot(slot: number): CharacterVariant {
  return VARIANT_BY_SLOT[slot % VARIANT_BY_SLOT.length] ?? "default";
}

export function textureKeyForVariant(variant: CharacterVariant): string {
  switch (variant) {
    case "king":
      return TEXTURES.playerKing;
    case "ninja":
      return TEXTURES.playerNinja;
    case "dragon":
      return TEXTURES.playerDragon;
    case "wizard":
      return TEXTURES.playerWizard;
    case "pirat":
      return TEXTURES.playerPirat;
    default:
      return TEXTURES.player;
  }
}

export function createCodeTextures(scene: Phaser.Scene): void {
  createCharacterVariants(scene);
  createBlock(scene, TEXTURES.dirt, 0x7a4b2a, 0xb6753c, 0x3c2415);
  createBlock(scene, TEXTURES.stone, 0x51586c, 0x798197, 0x252b38);
  createBlock(scene, TEXTURES.crate, 0x9b5d25, 0xd18a3d, 0x4d2a12);
  createBlock(scene, TEXTURES.redBlock, 0xdc2626, 0xf87171, 0x7f1d1d);
  createBlock(scene, TEXTURES.blueBlock, 0x2563eb, 0x60a5fa, 0x1e3a8a);
  createBlock(scene, TEXTURES.yellowBlock, 0xeab308, 0xfde047, 0x854d0e);
  createBlock(scene, TEXTURES.greenBlock, 0x16a34a, 0x4ade80, 0x14532d);
  createBlock(scene, TEXTURES.grayBlock, 0x6b7280, 0xd1d5db, 0x374151);
  createGem(scene);
  createBoostie(scene);
  createDash(scene);
  createBomb(scene);
  createShield(scene);
  createStunBolt(scene);
  createBurst(scene);
  createSpikes(scene);
  createFinish(scene);
}

// ─── Character variants ───────────────────────────────────────────────────────

function createCharacterVariants(scene: Phaser.Scene): void {
  drawSkullVariant(scene, TEXTURES.player, "default");
  drawSkullVariant(scene, TEXTURES.playerKing, "king");
  drawSkullVariant(scene, TEXTURES.playerNinja, "ninja");
  drawSkullVariant(scene, TEXTURES.playerDragon, "dragon");
  drawSkullVariant(scene, TEXTURES.playerWizard, "wizard");
  drawSkullVariant(scene, TEXTURES.playerPirat, "pirat");
}

/**
 * Draw a skull character to a 32×36 texture.
 * All variants share the same skull/body; only the headgear changes.
 */
export function drawSkullVariant(
  scene: Phaser.Scene,
  key: string,
  variant: CharacterVariant,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();

  // Body (blocky torso below skull)
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(6, 22, 20, 12, 3);

  // Skull head — circular
  g.fillStyle(0xffffff, 1);
  g.fillCircle(16, 14, 11);

  // Dark eye sockets
  g.fillStyle(0x151923, 1);
  g.fillCircle(11, 13, 3.5);
  g.fillCircle(21, 13, 3.5);

  // Nose dot
  g.fillStyle(0x151923, 0.7);
  g.fillCircle(16, 18, 1.5);

  // Headgear by variant
  switch (variant) {
    case "king":
      drawCrown(g);
      break;
    case "ninja":
      drawHeadband(g);
      break;
    case "dragon":
      drawHorns(g);
      break;
    case "wizard":
      drawWizardHat(g);
      break;
    case "pirat":
      drawTricornHat(g);
      break;
    default:
      break; // plain skull
  }

  g.generateTexture(key, 32, 36);
  g.destroy();
}

function drawCrown(g: Phaser.GameObjects.Graphics): void {
  // 3-pointed crown in gold above the skull
  g.fillStyle(0xfbbf24, 1);
  // Crown base band
  g.fillRect(8, 4, 16, 4);
  // Three points
  g.fillTriangle(8, 4, 10, 4, 9, -1);
  g.fillTriangle(14, 4, 18, 4, 16, -2);
  g.fillTriangle(22, 4, 24, 4, 23, -1);
  // Outline
  g.lineStyle(1, 0xd97706, 1);
  g.strokeRect(8, 4, 16, 4);
}

function drawHeadband(g: Phaser.GameObjects.Graphics): void {
  // Dark headband across the forehead
  g.fillStyle(0x1f2937, 1);
  g.fillRect(5, 8, 22, 5);
  // Knot / tie on the right side
  g.fillStyle(0x374151, 1);
  g.fillRect(25, 7, 4, 7);
  g.fillTriangle(29, 7, 32, 5, 29, 8);
  g.fillTriangle(29, 14, 32, 16, 29, 13);
}

function drawHorns(g: Phaser.GameObjects.Graphics): void {
  // Two small curved horns on top of skull
  g.fillStyle(0x6b7280, 1);
  g.fillTriangle(10, 5, 8, -3, 13, 3);
  g.fillTriangle(22, 5, 19, 3, 24, -3);
  g.fillStyle(0xd1d5db, 1);
  g.fillTriangle(10, 5, 9, 1, 12, 3);
  g.fillTriangle(22, 5, 20, 3, 23, 1);
}

function drawWizardHat(g: Phaser.GameObjects.Graphics): void {
  // Tall pointed hat
  g.fillStyle(0x7c3aed, 1);
  // Hat brim
  g.fillRect(4, 5, 24, 4);
  // Hat cone
  g.fillTriangle(7, 5, 16, -12, 25, 5);
  // Star on hat
  g.fillStyle(0xfde047, 1);
  g.fillCircle(16, 0, 2);
}

function drawTricornHat(g: Phaser.GameObjects.Graphics): void {
  // Tricorn hat silhouette
  g.fillStyle(0x111827, 1);
  // Brim
  g.fillRect(3, 6, 26, 3);
  // Hat body (flat top, wide)
  g.fillRect(6, 0, 20, 7);
  // Three cocked points
  g.fillTriangle(3, 6, 6, 0, 8, 6);
  g.fillTriangle(29, 6, 24, 0, 26, 6);
  // Eye-patch hint on the skull (over left eye area)
  g.lineStyle(2, 0x111827, 1);
  g.strokeCircle(11, 13, 4);
  g.lineStyle(1.5, 0x374151, 1);
  g.beginPath();
  g.moveTo(7, 11);
  g.lineTo(15, 11);
  g.strokePath();
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

function createBlock(
  scene: Phaser.Scene,
  key: string,
  base: number,
  highlight: number,
  shadow: number,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();

  // Base fill
  g.fillStyle(base, 1);
  g.fillRect(0, 0, 32, 32);

  // Chunky border (2px darker shade)
  g.lineStyle(3, shadow, 1);
  g.strokeRect(1.5, 1.5, 29, 29);

  // Inner highlight — top and left edges (lighter shade)
  g.fillStyle(highlight, 0.55);
  g.fillRect(3, 3, 26, 4);
  g.fillRect(3, 3, 4, 26);

  // Inner shadow — bottom and right edges
  g.fillStyle(shadow, 0.42);
  g.fillRect(3, 25, 26, 4);
  g.fillRect(25, 3, 4, 26);

  // Small highlight square in top-left corner (~8px)
  g.fillStyle(highlight, 0.75);
  g.fillRect(4, 4, 8, 8);

  // Subtle shadow square in bottom-right corner
  g.fillStyle(shadow, 0.48);
  g.fillRect(20, 20, 8, 8);

  g.generateTexture(key, 32, 32);
  g.destroy();
}

// ─── Pickups ──────────────────────────────────────────────────────────────────

function createGem(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.gem)) return;
  const g = scene.add.graphics();
  // Diamond shape (4-sided polygon)
  g.fillStyle(0x06b6d4, 1);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(16, 3),
      new Phaser.Math.Vector2(29, 16),
      new Phaser.Math.Vector2(16, 29),
      new Phaser.Math.Vector2(3, 16),
    ],
    true,
  );
  // Inner highlight facet
  g.fillStyle(0xe0f2fe, 0.7);
  g.fillTriangle(16, 4, 28, 15, 16, 15);
  // Outline
  g.lineStyle(1.5, 0x0891b2, 1);
  g.strokePoints(
    [
      new Phaser.Math.Vector2(16, 3),
      new Phaser.Math.Vector2(29, 16),
      new Phaser.Math.Vector2(16, 29),
      new Phaser.Math.Vector2(3, 16),
    ],
    true,
  );
  g.generateTexture(TEXTURES.gem, 32, 32);
  g.destroy();
}

function createBoostie(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.boostie)) return;
  const g = scene.add.graphics();
  // Lightning bolt shape
  g.fillStyle(0xfef08a, 1);
  g.fillCircle(16, 16, 13);
  g.fillStyle(0x1f2937, 1);
  // Bolt
  g.fillPoints(
    [
      new Phaser.Math.Vector2(19, 4),
      new Phaser.Math.Vector2(9, 17),
      new Phaser.Math.Vector2(16, 17),
      new Phaser.Math.Vector2(13, 28),
      new Phaser.Math.Vector2(23, 15),
      new Phaser.Math.Vector2(16, 15),
    ],
    true,
  );
  g.lineStyle(1.5, 0xfcd34d, 0.6);
  g.strokeCircle(16, 16, 13);
  g.generateTexture(TEXTURES.boostie, 32, 32);
  g.destroy();
}

function createDash(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.dash)) return;
  const g = scene.add.graphics();
  g.fillStyle(0xfacc15, 1);
  g.fillRoundedRect(5, 7, 22, 18, 6);
  g.fillStyle(0x1f2937, 1);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(18, 4),
      new Phaser.Math.Vector2(8, 18),
      new Phaser.Math.Vector2(16, 18),
      new Phaser.Math.Vector2(13, 30),
      new Phaser.Math.Vector2(25, 14),
      new Phaser.Math.Vector2(17, 14),
    ],
    true,
  );
  g.generateTexture(TEXTURES.dash, 32, 32);
  g.destroy();
}

function createBomb(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.bomb)) return;
  const g = scene.add.graphics();
  // Circle body
  g.fillStyle(0x111827, 1);
  g.fillCircle(15, 18, 11);
  g.lineStyle(1.5, 0x374151, 1);
  g.strokeCircle(15, 18, 11);
  // Fuse line at top
  g.lineStyle(3, 0xf59e0b, 1);
  g.beginPath();
  g.moveTo(19, 9);
  g.lineTo(26, 4);
  g.strokePath();
  // Fuse spark
  g.fillStyle(0xfef3c7, 1);
  g.fillCircle(26, 4, 3);
  g.fillStyle(0xef4444, 1);
  g.fillCircle(26, 4, 1.5);
  g.generateTexture(TEXTURES.bomb, 32, 32);
  g.destroy();
}

function createShield(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.shield)) return;
  const g = scene.add.graphics();
  // Hexagon outline for shield
  const cx = 16;
  const cy = 16;
  const r = 13;
  const hex: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    hex.push(new Phaser.Math.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
  }
  g.fillStyle(0x38bdf8, 1);
  g.fillPoints(hex, true);
  g.fillStyle(0xecfeff, 0.45);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(16, 5),
      new Phaser.Math.Vector2(23, 9),
      new Phaser.Math.Vector2(21, 18),
      new Phaser.Math.Vector2(16, 22),
    ],
    true,
  );
  g.lineStyle(2.5, 0x0ea5e9, 1);
  g.strokePoints(hex, true);
  g.generateTexture(TEXTURES.shield, 32, 32);
  g.destroy();
}

function createStunBolt(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.stunBolt)) return;
  const g = scene.add.graphics();
  // Star/jagged bolt shape
  g.fillStyle(0x312e81, 1);
  g.fillCircle(16, 16, 13);
  // Jagged star points (6-pointed)
  g.fillStyle(0xa78bfa, 1);
  const outerR = 12;
  const innerR = 5;
  const starPts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI / 6) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    starPts.push(new Phaser.Math.Vector2(16 + r * Math.cos(angle), 16 + r * Math.sin(angle)));
  }
  g.fillPoints(starPts, true);
  g.lineStyle(1.5, 0xf5f3ff, 0.7);
  g.strokeCircle(16, 16, 12.5);
  g.generateTexture(TEXTURES.stunBolt, 32, 32);
  g.destroy();
}

function createBurst(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.burst)) return;
  const g = scene.add.graphics();
  // Starburst: 4 short rays from center
  g.fillStyle(0xf97316, 1);
  g.fillCircle(16, 16, 10);
  g.fillStyle(0xfef3c7, 1);
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI / 2) * i;
    const tipX = 16 + Math.cos(angle) * 15;
    const tipY = 16 + Math.sin(angle) * 15;
    const perpX = Math.cos(angle + Math.PI / 2) * 3;
    const perpY = Math.sin(angle + Math.PI / 2) * 3;
    g.fillTriangle(
      16 + perpX,
      16 + perpY,
      16 - perpX,
      16 - perpY,
      tipX,
      tipY,
    );
  }
  g.fillStyle(0x7c2d12, 1);
  g.fillCircle(16, 16, 5);
  g.generateTexture(TEXTURES.burst, 32, 32);
  g.destroy();
}

function createSpikes(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.spikes)) return;
  const g = scene.add.graphics();
  g.fillStyle(0x272b36, 1);
  g.fillRect(0, 20, 32, 12);
  g.fillStyle(0xf43f5e, 1);
  for (let x = 0; x < 32; x += 8) {
    g.fillTriangle(x, 20, x + 4, 5, x + 8, 20);
  }
  g.generateTexture(TEXTURES.spikes, 32, 32);
  g.destroy();
}

function createFinish(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.finish)) return;
  const g = scene.add.graphics();
  // Checkered black/white pattern across the tile
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const isWhite = (row + col) % 2 === 0;
      g.fillStyle(isWhite ? 0xffffff : 0x111827, 0.96);
      g.fillRect(col * 8, row * 8, 8, 8);
    }
  }
  g.generateTexture(TEXTURES.finish, 32, 32);
  g.destroy();
}
