import Phaser from "phaser";

export const TEXTURES = {
  player: "raskulls-player",
  dirt: "raskulls-dirt",
  stone: "raskulls-stone",
  crate: "raskulls-crate",
  gem: "raskulls-gem",
  dash: "raskulls-dash",
  bomb: "raskulls-bomb",
  shield: "raskulls-shield",
  spikes: "raskulls-spikes",
  finish: "raskulls-finish",
} as const;

export function createCodeTextures(scene: Phaser.Scene): void {
  createPlayer(scene);
  createBlock(scene, TEXTURES.dirt, 0x7a4b2a, 0xb6753c, 0x3c2415);
  createBlock(scene, TEXTURES.stone, 0x51586c, 0x798197, 0x252b38);
  createBlock(scene, TEXTURES.crate, 0x9b5d25, 0xd18a3d, 0x4d2a12);
  createGem(scene);
  createDash(scene);
  createBomb(scene);
  createShield(scene);
  createSpikes(scene);
  createFinish(scene);
}

function createPlayer(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.player)) return;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(16, 14, 13);
  g.fillRoundedRect(5, 18, 22, 15, 5);
  g.fillStyle(0x151923, 1);
  g.fillCircle(11, 13, 3);
  g.fillCircle(21, 13, 3);
  g.fillRoundedRect(13, 19, 6, 3, 1);
  g.fillStyle(0xffffff, 1);
  g.fillRect(9, 29, 5, 5);
  g.fillRect(19, 29, 5, 5);
  g.generateTexture(TEXTURES.player, 32, 36);
  g.destroy();
}

function createBlock(
  scene: Phaser.Scene,
  key: string,
  base: number,
  highlight: number,
  shadow: number,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(base, 1);
  g.fillRect(0, 0, 32, 32);
  g.fillStyle(highlight, 1);
  g.fillRect(0, 0, 32, 4);
  g.fillRect(0, 0, 4, 32);
  g.fillStyle(shadow, 1);
  g.fillRect(0, 28, 32, 4);
  g.fillRect(28, 0, 4, 32);
  g.lineStyle(1, shadow, 0.5);
  g.strokeRect(0.5, 0.5, 31, 31);
  g.generateTexture(key, 32, 32);
  g.destroy();
}

function createGem(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.gem)) return;
  const g = scene.add.graphics();
  g.fillStyle(0x6ee7f9, 1);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(16, 3),
      new Phaser.Math.Vector2(29, 15),
      new Phaser.Math.Vector2(16, 30),
      new Phaser.Math.Vector2(3, 15),
    ],
    true,
  );
  g.fillStyle(0xf0fdff, 0.65);
  g.fillTriangle(16, 4, 26, 14, 15, 14);
  g.generateTexture(TEXTURES.gem, 32, 32);
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
  g.fillStyle(0x111827, 1);
  g.fillCircle(15, 18, 10);
  g.lineStyle(3, 0xf59e0b, 1);
  g.beginPath();
  g.moveTo(19, 10);
  g.lineTo(25, 5);
  g.strokePath();
  g.fillStyle(0xfef3c7, 1);
  g.fillCircle(25, 5, 3);
  g.generateTexture(TEXTURES.bomb, 32, 32);
  g.destroy();
}

function createShield(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.shield)) return;
  const g = scene.add.graphics();
  g.fillStyle(0x38bdf8, 1);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(16, 3),
      new Phaser.Math.Vector2(27, 8),
      new Phaser.Math.Vector2(24, 22),
      new Phaser.Math.Vector2(16, 30),
      new Phaser.Math.Vector2(8, 22),
      new Phaser.Math.Vector2(5, 8),
    ],
    true,
  );
  g.fillStyle(0xecfeff, 0.55);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(16, 7),
      new Phaser.Math.Vector2(22, 10),
      new Phaser.Math.Vector2(20, 20),
      new Phaser.Math.Vector2(16, 24),
    ],
    true,
  );
  g.generateTexture(TEXTURES.shield, 32, 32);
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
  g.fillStyle(0xffffff, 0.95);
  for (let y = 0; y < 32; y += 8) {
    for (let x = 0; x < 32; x += 8) {
      if ((x + y) % 16 === 0) g.fillRect(x, y, 8, 8);
    }
  }
  g.fillStyle(0x111827, 0.95);
  for (let y = 0; y < 32; y += 8) {
    for (let x = 0; x < 32; x += 8) {
      if ((x + y) % 16 !== 0) g.fillRect(x, y, 8, 8);
    }
  }
  g.generateTexture(TEXTURES.finish, 32, 32);
  g.destroy();
}
