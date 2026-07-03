import type { LaunchContext, PlayerStanding } from "@pfp/sdk";

// --- Tuning constants (logical units; arena is 960×720) ----------------------
export const ARENA_W = 960;
export const ARENA_H = 720;
export const FIXED_DT = 1 / 60;
export const FIXED_MS = 1000 / 60;

export const SHIP_W = 36;
export const SHIP_H = 24;
export const SHIP_Y = ARENA_H - 60; // top of the ship
export const SHIP_SPEED = 380; // px/sec
export const SHIP_SHOOT_COOLDOWN = 350; // ms
export const SHIP_LIVES = 3;
export const SHIP_RESPAWN_MS = 1200;
export const SHIP_INVINCIBLE_MS = 2000;

export const PLAYER_BULLET_W = 4;
export const PLAYER_BULLET_H = 12;
export const PLAYER_BULLET_SPEED = 600;

export const ALIEN_BULLET_W = 4;
export const ALIEN_BULLET_H = 10;
export const ALIEN_BULLET_SPEED = 280;

export const ALIEN_COLS = 11;
export const ALIEN_ROWS = 5;
export const ALIEN_W = 28;
export const ALIEN_H = 22;
export const ALIEN_GAP_X = 12;
export const ALIEN_GAP_Y = 14;
export const ALIEN_GRID_START_X = 64;
export const ALIEN_GRID_START_Y = 60;
export const ALIEN_SPEED_BASE = 60;
export const ALIEN_DESCEND_AMOUNT = 20;
export const ALIEN_SPEEDUP = 1.1;
export const ALIEN_SPEED_MAX = 300;
export const ALIEN_SHOOT_INTERVAL_BASE = 850; // ms
export const ALIEN_SHOOT_INTERVAL_MIN = 220;

export const SHIELD_COUNT = 4;
export const SHIELD_W = 72;
export const SHIELD_H = 36;
export const SHIELD_CELLS_X = 12;
export const SHIELD_CELLS_Y = 6;
const SHIELD_SPACING = (ARENA_W - SHIELD_COUNT * SHIELD_W) / (SHIELD_COUNT + 1);

export const SAUCER_POINTS = [50, 100, 150, 300];
export const SAUCER_INTERVAL_BASE = 22000;
export const SAUCER_SPEED = 130;
export const SAUCER_W = 40;
export const SAUCER_H = 18;
export const SAUCER_Y = 40;

export const WAVE_COUNT = 12;
export const WAVE_BANNER_MS = 1800;
export const WIN_HOLD_MS = 3500;

export const ATTRACT_TEXT_MS = 700;

const SHAKE_DECAY = 50;

// Per-row alien score values (row 0 = top, row 4 = bottom)
const ROW_SCORE = [50, 40, 30, 20, 10];

// --- Power-ups ---------------------------------------------------------------
/** Chance a destroyed alien drops a power-up. Saucers always drop one. */
export const POWERUP_DROP_CHANCE = 0.12;
export const POWERUP_FALL_SPEED = 150; // px/sec
export const POWERUP_W = 24;
export const POWERUP_H = 24;
export const POWERUP_DURATION_MS = 8000; // rapid / spread / pierce
export const SHIELD_DURATION_MS = 6000; // protective bubble
export const RAPID_FIRE_COOLDOWN = 110; // ms between shots while rapid is active
export const RAPID_MAX_BULLETS = 4; // simultaneous bullets while rapid is active
export const SPREAD_VX = 220; // px/sec horizontal drift for angled spread bullets
export const MAX_LIVES = 6;

// --- Combo -------------------------------------------------------------------
export const COMBO_WINDOW_MS = 2500; // time to chain the next kill
export const COMBO_MAX = 8; // max score multiplier

export type PowerUpKind = "rapid" | "spread" | "pierce" | "shield" | "life";
/** Weighted drop table. `life` is rarer than the offensive/defensive buffs. */
const POWERUP_TABLE: PowerUpKind[] = [
  "rapid",
  "rapid",
  "spread",
  "spread",
  "pierce",
  "pierce",
  "shield",
  "shield",
  "life",
];

export type Phase = "attract" | "playing" | "wavetransition" | "gameover";
export type SoundKind =
  | "shoot"
  | "alienHit"
  | "playerHit"
  | "shieldHit"
  | "saucerLoop"
  | "saucerHit"
  | "waveClear"
  | "gameOver"
  | "victory"
  | "powerupDrop"
  | "powerup"
  | "extraLife"
  | "shieldBlock";

export interface PlayerBullet {
  x: number;
  y: number;
  /** Horizontal drift (px/sec). Non-zero for angled spread-shot bullets. */
  vx?: number;
  /** Piercing bullets pass through aliens instead of being consumed. */
  piercing?: boolean;
}

export interface PowerUp {
  x: number;
  y: number;
  kind: PowerUpKind;
}

export interface AlienBullet {
  x: number;
  y: number;
}

export interface ShipState {
  slot: number;
  profileId: string | null;
  displayName: string;
  color: string;
  gamepadIndex: number;
  spawnX: number;
  x: number;
  score: number;
  aliensKilled: number;
  shotsFired: number;
  deaths: number;
  lives: number;
  shootCooldown: number;
  respawnTimer: number;
  invincibleTimer: number;
  bullet: PlayerBullet | null;
  /** Additional simultaneous bullets from spread-shot / rapid-fire power-ups. */
  extraBullets: PlayerBullet[];
  axis: number;
  shootHeld: boolean;
  // Power-up timers (ms remaining; 0 = inactive)
  rapidTimer: number;
  spreadTimer: number;
  pierceTimer: number;
  shieldTimer: number;
  // Combo tracking
  comboCount: number;
  comboTimer: number;
  maxCombo: number;
  // Stats
  powerUpsCollected: number;
}

export interface Alien {
  col: number;
  row: number;
  alive: boolean;
  frame: number;
}

export interface Saucer {
  x: number;
  y: number;
  dir: 1 | -1;
  points: number;
}

export interface Shield {
  x: number;
  y: number;
  cells: boolean[][];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  brightness: number;
}

export interface GameState {
  players: ShipState[];
  aliens: Alien[][];
  alienGridX: number;
  alienGridY: number;
  alienDir: 1 | -1;
  alienSpeed: number;
  alienShootTimer: number;
  alienBullets: AlienBullet[];
  shields: Shield[];
  powerUps: PowerUp[];
  saucer: Saucer | null;
  saucerTimer: number;
  saucerSound: boolean;
  wave: number;
  totalAliensKilled: number;
  phase: Phase;
  waveBannerTimer: number;
  goTimer: number;
  victory: boolean;
  ended: boolean;
  shake: number;
  particles: Particle[];
  stars: Star[];
  events: SoundKind[];
  acc: number;
  attractBlink: number;
}

export interface PlayerInput {
  axis: number;
  shoot: boolean;
  start: boolean;
  back: boolean;
}

export interface InputFrame {
  inputs: PlayerInput[];
  anyStart: boolean;
  /** Edge: any player tapped Fire this frame. Used to leave the attract screen. */
  anyFire?: boolean;
}

function shipSpawnX(index: number, playerCount: number): number {
  return (ARENA_W * (index + 1)) / (playerCount + 1);
}

function makeShip(
  p: LaunchContext["players"][number],
  index: number,
  playerCount: number,
): ShipState {
  const spawnX = shipSpawnX(index, playerCount);
  return {
    slot: p.slot,
    profileId: p.profileId,
    displayName: p.displayName,
    color: p.color,
    gamepadIndex: p.gamepadIndex,
    spawnX,
    x: spawnX,
    score: 0,
    aliensKilled: 0,
    shotsFired: 0,
    deaths: 0,
    lives: SHIP_LIVES,
    shootCooldown: 0,
    respawnTimer: 0,
    invincibleTimer: 0,
    bullet: null,
    extraBullets: [],
    axis: 0,
    shootHeld: false,
    rapidTimer: 0,
    spreadTimer: 0,
    pierceTimer: 0,
    shieldTimer: 0,
    comboCount: 0,
    comboTimer: 0,
    maxCombo: 0,
    powerUpsCollected: 0,
  };
}

function makeShields(): Shield[] {
  const shields: Shield[] = [];
  for (let i = 0; i < SHIELD_COUNT; i++) {
    const x = SHIELD_SPACING + i * (SHIELD_W + SHIELD_SPACING);
    const cells: boolean[][] = [];
    for (let cx = 0; cx < SHIELD_CELLS_X; cx++) {
      cells.push(new Array(SHIELD_CELLS_Y).fill(true));
    }
    shields.push({ x, y: SHIP_Y - 64, cells });
  }
  return shields;
}

function makeStarfield(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * ARENA_W,
      y: Math.random() * ARENA_H,
      speed: Math.random() * 30 + 10,
      size: Math.random() * 1.8 + 0.6,
      brightness: Math.random() * 0.4 + 0.15,
    });
  }
  return stars;
}

export function spawnWave(state: GameState): void {
  state.alienSpeed = Math.min(
    ALIEN_SPEED_BASE * Math.pow(ALIEN_SPEEDUP, state.wave - 1),
    ALIEN_SPEED_MAX,
  );
  state.alienGridX = ALIEN_GRID_START_X;
  state.alienGridY = ALIEN_GRID_START_Y;
  state.alienDir = 1;
  state.alienShootTimer = Math.max(
    ALIEN_SHOOT_INTERVAL_MIN,
    ALIEN_SHOOT_INTERVAL_BASE - (state.wave - 1) * 50,
  );
  state.alienBullets.length = 0;
  state.powerUps.length = 0;
  state.saucer = null;
  state.saucerTimer = SAUCER_INTERVAL_BASE + Math.random() * 8000;

  state.aliens = [];
  for (let row = 0; row < ALIEN_ROWS; row++) {
    const rowAliens: Alien[] = [];
    for (let col = 0; col < ALIEN_COLS; col++) {
      rowAliens.push({ col, row, alive: true, frame: 0 });
    }
    state.aliens.push(rowAliens);
  }

  // Repair shields
  for (const shield of state.shields) {
    let destroyed = 0;
    for (let cx = 0; cx < SHIELD_CELLS_X; cx++) {
      for (let cy = 0; cy < SHIELD_CELLS_Y; cy++) {
        if (!shield.cells[cx]![cy]) destroyed++;
      }
    }
    const toRepair = Math.floor(destroyed * 0.35);
    for (let n = 0; n < toRepair; n++) {
      const cx = Math.floor(Math.random() * SHIELD_CELLS_X);
      const cy = Math.floor(Math.random() * SHIELD_CELLS_Y);
      if (!shield.cells[cx]![cy]) shield.cells[cx]![cy] = true;
    }
  }

  // Respawn dead players who still have lives
  for (const p of state.players) {
    if (p.lives > 0 && p.respawnTimer > 0) {
      p.x = p.spawnX;
      p.respawnTimer = 0;
      p.invincibleTimer = SHIP_INVINCIBLE_MS;
      p.shootCooldown = 0;
      p.bullet = null;
      p.extraBullets.length = 0;
    }
  }
}

function respawnPlayer(p: ShipState): void {
  p.x = p.spawnX;
  p.respawnTimer = 0;
  p.invincibleTimer = SHIP_INVINCIBLE_MS;
  p.shootCooldown = 0;
  p.bullet = null;
  p.extraBullets.length = 0;
}

export function createGame(context: LaunchContext): GameState {
  const shields = makeShields();
  return {
    players: context.players.map((player, index) =>
      makeShip(player, index, context.players.length),
    ),
    aliens: [],
    alienGridX: ALIEN_GRID_START_X,
    alienGridY: ALIEN_GRID_START_Y,
    alienDir: 1,
    alienSpeed: ALIEN_SPEED_BASE,
    alienShootTimer: ALIEN_SHOOT_INTERVAL_BASE,
    alienBullets: [],
    shields,
    powerUps: [],
    saucer: null,
    saucerTimer: SAUCER_INTERVAL_BASE + Math.random() * 8000,
    saucerSound: false,
    wave: 0,
    totalAliensKilled: 0,
    phase: "attract",
    waveBannerTimer: 0,
    goTimer: 0,
    victory: false,
    ended: false,
    shake: 0,
    particles: [],
    stars: makeStarfield(),
    events: [],
    acc: 0,
    attractBlink: 0,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Returns true if any alien is alive. */
function anyAliensAlive(aliens: Alien[][]): boolean {
  for (const row of aliens) {
    for (const a of row) {
      if (a.alive) return true;
    }
  }
  return false;
}

function bottommostAliveCol(aliens: Alien[][], col: number): number {
  for (let r = ALIEN_ROWS - 1; r >= 0; r--) {
    if (aliens[r]![col]!.alive) return r;
  }
  return -1;
}

function gridBounds(aliens: Alien[][], gridX: number): { left: number; right: number } | null {
  let left = Infinity;
  let right = -Infinity;
  for (let row = 0; row < ALIEN_ROWS; row++) {
    for (let col = 0; col < ALIEN_COLS; col++) {
      if (aliens[row]![col]!.alive) {
        const ax = gridX + col * (ALIEN_W + ALIEN_GAP_X);
        if (ax < left) left = ax;
        if (ax + ALIEN_W > right) right = ax + ALIEN_W;
      }
    }
  }
  if (!isFinite(left)) return null;
  return { left, right };
}

function alienCenterX(gridX: number, col: number): number {
  return gridX + col * (ALIEN_W + ALIEN_GAP_X) + ALIEN_W / 2;
}

function alienCenterY(gridY: number, row: number): number {
  return gridY + row * (ALIEN_H + ALIEN_GAP_Y) + ALIEN_H / 2;
}

function alienRect(
  gridX: number,
  gridY: number,
  col: number,
  row: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: gridX + col * (ALIEN_W + ALIEN_GAP_X),
    y: gridY + row * (ALIEN_H + ALIEN_GAP_Y),
    w: ALIEN_W,
    h: ALIEN_H,
  };
}

function damageShield(shield: Shield, hx: number, hy: number): boolean {
  const cx = Math.floor(((hx - shield.x) / SHIELD_W) * SHIELD_CELLS_X);
  const cy = Math.floor(((hy - shield.y) / SHIELD_H) * SHIELD_CELLS_Y);
  if (cx >= 0 && cx < SHIELD_CELLS_X && cy >= 0 && cy < SHIELD_CELLS_Y) {
    if (shield.cells[cx]![cy]) {
      shield.cells[cx]![cy] = false;
      return true;
    }
  }
  return false;
}

function spawnParticles(
  state: GameState,
  x: number,
  y: number,
  color: string,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * 200 + 50;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      color,
      size: Math.random() * 3 + 1.5,
      life: Math.random() * 200 + 140,
      maxLife: 340,
    });
  }
}

function maybeDropPowerUp(state: GameState, x: number, y: number): void {
  if (Math.random() > POWERUP_DROP_CHANCE) return;
  dropPowerUp(state, x, y);
}

function dropPowerUp(state: GameState, x: number, y: number): void {
  const kind = POWERUP_TABLE[Math.floor(Math.random() * POWERUP_TABLE.length)]!;
  state.powerUps.push({ x, y, kind });
  state.events.push("powerupDrop");
}

/** Registers an alien kill: combo bookkeeping, scoring, FX, and power-up drops. */
function handleAlienKill(
  state: GameState,
  p: ShipState,
  row: number,
  col: number,
  hitX: number,
  hitY: number,
): void {
  state.aliens[row]![col]!.alive = false;

  // Combo: chaining kills inside the window ramps the score multiplier.
  p.comboCount = p.comboTimer > 0 ? p.comboCount + 1 : 1;
  p.comboTimer = COMBO_WINDOW_MS;
  if (p.comboCount > p.maxCombo) p.maxCombo = p.comboCount;
  const mult = Math.min(p.comboCount, COMBO_MAX);

  p.score += ROW_SCORE[row]! * mult;
  p.aliensKilled++;
  state.totalAliensKilled++;
  state.events.push("alienHit");
  state.shake = Math.max(state.shake, 2);
  spawnParticles(state, hitX, hitY, "#4ade80", 8);
  maybeDropPowerUp(state, alienCenterX(state.alienGridX, col), hitY);
}

function applyPowerUp(state: GameState, p: ShipState, kind: PowerUpKind): void {
  p.powerUpsCollected++;
  state.events.push("powerup");
  switch (kind) {
    case "rapid":
      p.rapidTimer = POWERUP_DURATION_MS;
      break;
    case "spread":
      p.spreadTimer = POWERUP_DURATION_MS;
      break;
    case "pierce":
      p.pierceTimer = POWERUP_DURATION_MS;
      break;
    case "shield":
      p.shieldTimer = SHIELD_DURATION_MS;
      break;
    case "life":
      if (p.lives < MAX_LIVES) p.lives++;
      state.events.push("extraLife");
      break;
  }
  spawnParticles(state, p.x, SHIP_Y + SHIP_H / 2, p.color, 14);
}

/**
 * Advances one player bullet and resolves collisions. Returns true if the
 * bullet should be removed (consumed or off-screen). Piercing bullets survive
 * alien hits so they can cut through a column.
 */
function stepPlayerBullet(state: GameState, p: ShipState, b: PlayerBullet): boolean {
  b.y -= PLAYER_BULLET_SPEED * FIXED_DT;
  if (b.vx) b.x += b.vx * FIXED_DT;

  const bx = b.x;
  const by = b.y;

  // Aliens (at most one kill per step)
  for (let row = 0; row < ALIEN_ROWS; row++) {
    for (let col = 0; col < ALIEN_COLS; col++) {
      const a = state.aliens[row]![col]!;
      if (!a.alive) continue;
      const r = alienRect(state.alienGridX, state.alienGridY, col, row);
      if (bx >= r.x && bx <= r.x + r.w && by <= r.y + r.h && by >= r.y) {
        handleAlienKill(state, p, row, col, bx, r.y + r.h / 2);
        return !b.piercing; // piercing bullets carry on
      }
    }
  }

  // Saucer
  if (state.saucer) {
    const s = state.saucer;
    if (
      bx >= s.x - SAUCER_W / 2 &&
      bx <= s.x + SAUCER_W / 2 &&
      by <= s.y + SAUCER_H / 2 &&
      by >= s.y - SAUCER_H / 2
    ) {
      p.score += s.points;
      spawnParticles(state, s.x, s.y, "#facc15", 14);
      state.events.push("saucerHit");
      dropPowerUp(state, s.x, s.y); // saucers always reward a power-up
      state.saucer = null;
      state.saucerSound = false;
      return true;
    }
  }

  // Shields
  for (const shield of state.shields) {
    if (
      bx >= shield.x &&
      bx <= shield.x + SHIELD_W &&
      by >= shield.y &&
      by <= shield.y + SHIELD_H
    ) {
      if (damageShield(shield, bx, by)) {
        state.events.push("shieldHit");
      }
      return true;
    }
  }

  // Off-screen (top or, for spread bullets, the sides)
  if (by + PLAYER_BULLET_H < 0) return true;
  if (bx < -PLAYER_BULLET_W || bx > ARENA_W + PLAYER_BULLET_W) return true;

  return false;
}

function killPlayer(state: GameState, p: ShipState): boolean {
  p.deaths++;
  p.lives--;
  p.bullet = null;
  p.extraBullets.length = 0;
  p.comboCount = 0;
  p.comboTimer = 0;
  state.events.push("playerHit");
  state.shake = Math.max(state.shake, 14);
  spawnParticles(state, p.x, SHIP_Y + SHIP_H / 2, p.color, 22);

  if (p.lives > 0) {
    p.respawnTimer = SHIP_RESPAWN_MS;
    p.invincibleTimer = 0;
    p.shootCooldown = 0;
    return false;
  }
  p.respawnTimer = 999999; // dead for good
  return true; // final death
}

function allPlayersDead(state: GameState): boolean {
  return state.players.every((p) => p.lives <= 0 && p.respawnTimer > 0);
}

/** One fixed physics tick. */
export function stepFixed(state: GameState): void {
  if (state.phase !== "playing") return;

  // --- Move player bullets (primary + power-up extras) ---
  for (const p of state.players) {
    if (p.bullet && stepPlayerBullet(state, p, p.bullet)) {
      p.bullet = null;
    }
    for (let i = p.extraBullets.length - 1; i >= 0; i--) {
      if (stepPlayerBullet(state, p, p.extraBullets[i]!)) {
        p.extraBullets.splice(i, 1);
      }
    }
  }

  // --- Move power-ups (fall + collection) ---
  for (let i = state.powerUps.length - 1; i >= 0; i--) {
    const pu = state.powerUps[i]!;
    pu.y += POWERUP_FALL_SPEED * FIXED_DT;

    let collected = false;
    for (const p of state.players) {
      if (p.respawnTimer > 0) continue; // dead/respawning ships can't grab
      if (
        pu.x >= p.x - SHIP_W / 2 - 6 &&
        pu.x <= p.x + SHIP_W / 2 + 6 &&
        pu.y + POWERUP_H / 2 >= SHIP_Y &&
        pu.y - POWERUP_H / 2 <= SHIP_Y + SHIP_H
      ) {
        applyPowerUp(state, p, pu.kind);
        collected = true;
        break;
      }
    }
    if (collected || pu.y - POWERUP_H / 2 > ARENA_H) {
      state.powerUps.splice(i, 1);
    }
  }

  // --- Move alien bullets ---
  for (let i = state.alienBullets.length - 1; i >= 0; i--) {
    const ab = state.alienBullets[i]!;
    ab.y += ALIEN_BULLET_SPEED * FIXED_DT;

    const bx = ab.x;
    const by = ab.y;

    // Check player hits
    let bulletConsumed = false;
    for (const p of state.players) {
      if (p.respawnTimer > 0) continue; // dead/respawning
      const shipLeft = p.x - SHIP_W / 2;
      const shipRight = p.x + SHIP_W / 2;
      if (bx >= shipLeft && bx <= shipRight && by >= SHIP_Y && by <= SHIP_Y + SHIP_H) {
        if (p.invincibleTimer > 0) {
          // Invincible — bullet passes through
          continue;
        }
        if (p.shieldTimer > 0) {
          // Shield bubble absorbs the shot without harming the ship.
          spawnParticles(state, bx, by, "#38bdf8", 10);
          state.events.push("shieldBlock");
          bulletConsumed = true;
          break;
        }
        const finalDeath = killPlayer(state, p);
        if (finalDeath && allPlayersDead(state)) {
          goToGameOver(state);
        }
        bulletConsumed = true;
        break;
      }
    }
    if (bulletConsumed) {
      state.alienBullets.splice(i, 1);
      continue;
    }

    // Check shield hits
    for (const shield of state.shields) {
      if (
        bx >= shield.x &&
        bx <= shield.x + SHIELD_W &&
        by >= shield.y &&
        by <= shield.y + SHIELD_H
      ) {
        if (damageShield(shield, bx, by)) {
          state.events.push("shieldHit");
        }
        bulletConsumed = true;
        break;
      }
    }
    if (bulletConsumed) {
      state.alienBullets.splice(i, 1);
      continue;
    }

    // Off screen bottom
    if (by > ARENA_H) {
      state.alienBullets.splice(i, 1);
    }
  }

  // --- Move alien grid ---
  state.alienGridX += state.alienDir * state.alienSpeed * FIXED_DT;
  const bounds = gridBounds(state.aliens, state.alienGridX);
  if (bounds) {
    if (bounds.left <= 0 && state.alienDir < 0) {
      state.alienGridX += -bounds.left;
      state.alienGridY += ALIEN_DESCEND_AMOUNT;
      state.alienDir = 1;
      state.alienSpeed *= 1.02;
      state.shake = Math.max(state.shake, 3);
      // Check if aliens reached the player zone
      checkAlienInvasion(state);
    } else if (bounds.right >= ARENA_W && state.alienDir > 0) {
      state.alienGridX -= bounds.right - ARENA_W;
      state.alienGridY += ALIEN_DESCEND_AMOUNT;
      state.alienDir = -1;
      state.alienSpeed *= 1.02;
      state.shake = Math.max(state.shake, 3);
      checkAlienInvasion(state);
    }
  }

  // --- Alien shooting ---
  state.alienShootTimer -= FIXED_MS;
  if (state.alienShootTimer <= 0) {
    state.alienShootTimer = Math.max(
      ALIEN_SHOOT_INTERVAL_MIN,
      ALIEN_SHOOT_INTERVAL_BASE - (state.wave - 1) * 50 + Math.random() * 300,
    );

    // Pick a random column that has alive aliens, shoot from bottommost
    const eligibleCols: number[] = [];
    for (let col = 0; col < ALIEN_COLS; col++) {
      if (bottommostAliveCol(state.aliens, col) >= 0) eligibleCols.push(col);
    }
    if (eligibleCols.length > 0) {
      const col = eligibleCols[Math.floor(Math.random() * eligibleCols.length)]!;
      const row = bottommostAliveCol(state.aliens, col);
      if (row >= 0) {
        state.alienBullets.push({
          x: alienCenterX(state.alienGridX, col),
          y: alienCenterY(state.alienGridY, row) + ALIEN_H / 2,
        });
      }
    }
  }

  // --- Saucer ---
  state.saucerTimer -= FIXED_MS;
  if (!state.saucer && state.saucerTimer <= 0) {
    const fromRight = Math.random() < 0.5;
    const points = SAUCER_POINTS[Math.floor(Math.random() * SAUCER_POINTS.length)]!;
    state.saucer = {
      x: fromRight ? ARENA_W + SAUCER_W : -SAUCER_W,
      y: SAUCER_Y,
      dir: fromRight ? -1 : 1,
      points,
    };
    state.saucerSound = true;
  }
  if (state.saucer) {
    const s = state.saucer;
    s.x += s.dir * SAUCER_SPEED * FIXED_DT;
    if ((s.dir < 0 && s.x < -SAUCER_W) || (s.dir > 0 && s.x > ARENA_W + SAUCER_W)) {
      state.saucer = null;
      state.saucerSound = false;
      state.saucerTimer = SAUCER_INTERVAL_BASE + Math.random() * 10000;
    }
  }

  // --- Wave cleared check ---
  if (!anyAliensAlive(state.aliens)) {
    state.events.push("waveClear");
    if (state.wave >= WAVE_COUNT) {
      state.victory = true;
      state.phase = "gameover";
      state.goTimer = WIN_HOLD_MS;
      state.events.push("victory");
    } else {
      state.wave++;
      state.phase = "wavetransition";
      state.waveBannerTimer = WAVE_BANNER_MS;
    }
  }
}

function checkAlienInvasion(state: GameState): void {
  const bounds = gridBounds(state.aliens, state.alienGridX);
  if (!bounds) return;
  const bottomY = state.alienGridY + ALIEN_ROWS * (ALIEN_H + ALIEN_GAP_Y) - ALIEN_GAP_Y;
  if (bottomY >= SHIP_Y - 20) {
    goToGameOver(state);
  }
}

function goToGameOver(state: GameState): void {
  state.phase = "gameover";
  state.goTimer = WIN_HOLD_MS;
  state.victory = false;
  state.events.push("gameOver");
  // Kill all remaining lives
  for (const p of state.players) {
    p.lives = 0;
    p.respawnTimer = 999999;
    p.bullet = null;
    p.extraBullets.length = 0;
  }
}

function updatePlayers(state: GameState, dt: number): void {
  for (const p of state.players) {
    // Power-up timers tick down regardless of alive/dead state.
    if (p.rapidTimer > 0) p.rapidTimer = Math.max(0, p.rapidTimer - dt);
    if (p.spreadTimer > 0) p.spreadTimer = Math.max(0, p.spreadTimer - dt);
    if (p.pierceTimer > 0) p.pierceTimer = Math.max(0, p.pierceTimer - dt);
    if (p.shieldTimer > 0) p.shieldTimer = Math.max(0, p.shieldTimer - dt);
    if (p.comboTimer > 0) {
      p.comboTimer -= dt;
      if (p.comboTimer <= 0) {
        p.comboTimer = 0;
        p.comboCount = 0;
      }
    }

    // Respawn timer
    if (p.respawnTimer > 0) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0 && p.lives > 0) {
        respawnPlayer(p);
      }
      continue;
    }

    // Invincibility timer
    if (p.invincibleTimer > 0) {
      p.invincibleTimer -= dt;
    }

    // Shoot cooldown
    if (p.shootCooldown > 0) {
      p.shootCooldown -= dt;
    }

    // Movement (only during playing or if alive)
    if (state.phase === "playing") {
      p.x += p.axis * SHIP_SPEED * (dt / 1000);
      p.x = clamp(p.x, SHIP_W / 2, ARENA_W - SHIP_W / 2);

      // Shooting. Rapid-fire lowers the cooldown and lets several bullets be
      // in flight at once; otherwise the classic one-bullet limit applies.
      const rapid = p.rapidTimer > 0;
      const cooldown = rapid ? RAPID_FIRE_COOLDOWN : SHIP_SHOOT_COOLDOWN;
      const activeBullets = (p.bullet ? 1 : 0) + p.extraBullets.length;
      const maxBullets = rapid ? RAPID_MAX_BULLETS : 1;
      if (p.shootHeld && p.shootCooldown <= 0 && activeBullets < maxBullets) {
        firePlayer(state, p);
        p.shootCooldown = cooldown;
      }
    }
  }
}

/** Spawns the player's bullet(s), honoring active spread/pierce power-ups. */
function firePlayer(state: GameState, p: ShipState): void {
  const piercing = p.pierceTimer > 0;
  const spread = p.spreadTimer > 0;
  const primary: PlayerBullet = { x: p.x, y: SHIP_Y, piercing };
  if (!p.bullet) p.bullet = primary;
  else p.extraBullets.push(primary);

  if (spread) {
    p.extraBullets.push({ x: p.x, y: SHIP_Y, vx: -SPREAD_VX, piercing });
    p.extraBullets.push({ x: p.x, y: SHIP_Y, vx: SPREAD_VX, piercing });
    p.shotsFired += 3;
  } else {
    p.shotsFired += 1;
  }
  state.events.push("shoot");
}

function updateFX(state: GameState, dt: number): void {
  state.shake = Math.max(0, state.shake - (SHAKE_DECAY * dt) / 1000);
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]!;
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.x += (p.vx * dt) / 1000;
    p.y += (p.vy * dt) / 1000;
    p.vy += (600 * dt) / 1000; // gravity
  }
  state.attractBlink += dt;
}

function updateStars(state: GameState, dt: number): void {
  for (const s of state.stars) {
    s.y += (s.speed * dt) / 1000;
    if (s.y > ARENA_H) {
      s.y = -4;
      s.x = Math.random() * ARENA_W;
    }
  }
}

export function standingsFor(state: GameState): PlayerStanding[] {
  const sorted = [...state.players].sort((a, b) => b.score - a.score);

  const result: PlayerStanding[] = [];
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    if (i > 0 && sorted[i]!.score < sorted[i - 1]!.score) {
      currentRank = i + 1;
    }
    const shots = p.shotsFired;
    const accuracy = shots > 0 ? Math.round((p.aliensKilled / shots) * 100) : 0;
    result.push({
      slot: p.slot,
      profileId: p.profileId,
      rank: currentRank,
      score: p.score,
      stats: {
        aliensKilled: p.aliensKilled,
        shotsFired: shots,
        accuracy,
        deaths: p.deaths,
        powerUpsCollected: p.powerUpsCollected,
        maxCombo: p.maxCombo,
      },
    });
  }
  return result;
}

/**
 * Frame-level update. Applies input, advances physics in fixed steps, handles
 * the state machine, and updates FX. Returns final standings exactly once (when
 * the match ends), otherwise null.
 */
export function advance(
  state: GameState,
  dtMs: number,
  frame: InputFrame,
): PlayerStanding[] | null {
  const dt = Math.min(dtMs, 100);

  // Apply inputs
  for (let i = 0; i < state.players.length && i < frame.inputs.length; i++) {
    const p = state.players[i]!;
    p.axis = frame.inputs[i]!.axis;
    p.shootHeld = frame.inputs[i]!.shoot;
  }

  updateFX(state, dt);
  updateStars(state, dt);

  switch (state.phase) {
    case "attract":
      // Start on Fire (the shell reserves the Start button for its pause menu),
      // or on Start when running standalone via keyboard.
      if (frame.anyStart || frame.anyFire) {
        state.wave = 1;
        state.phase = "wavetransition";
        state.waveBannerTimer = WAVE_BANNER_MS;
        spawnWave(state);
      }
      break;
    case "wavetransition":
      updatePlayers(state, dt);
      state.waveBannerTimer -= dt;
      state.acc += dt;
      drainSteps(state);
      if (state.waveBannerTimer <= 0) {
        spawnWave(state);
        state.phase = "playing";
      }
      break;
    case "playing": {
      updatePlayers(state, dt);
      state.acc += dt;
      drainSteps(state);
      break;
    }
    case "gameover":
      updatePlayers(state, dt);
      state.goTimer -= dt;
      if (!state.ended && state.goTimer <= 0) {
        state.ended = true;
        return standingsFor(state);
      }
      break;
  }
  return null;
}

function drainSteps(state: GameState): void {
  while (state.acc >= FIXED_MS) {
    state.acc -= FIXED_MS;
    stepFixed(state);
    // Stop draining if phase changed mid-step
    if (state.phase === "gameover" || state.phase === "wavetransition") {
      state.acc = 0;
      break;
    }
  }
}
