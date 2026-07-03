import {
  ALIEN_COLS,
  ALIEN_GAP_X,
  ALIEN_GAP_Y,
  ALIEN_H,
  ALIEN_ROWS,
  ALIEN_W,
  ARENA_H,
  ARENA_W,
  PLAYER_BULLET_H,
  PLAYER_BULLET_W,
  ALIEN_BULLET_H,
  ALIEN_BULLET_W,
  POWERUP_DURATION_MS,
  POWERUP_H,
  POWERUP_W,
  SHIELD_DURATION_MS,
  SAUCER_H,
  SAUCER_W,
  SHIELD_CELLS_X,
  SHIELD_CELLS_Y,
  SHIELD_H,
  SHIELD_W,
  SHIP_H,
  SHIP_W,
  SHIP_Y,
  type GameState,
  type PlayerBullet,
  type PowerUpKind,
  type ShipState,
} from "./game.js";

const FONT = "'Segoe UI', system-ui, sans-serif";
const ALIEN_FRAME_RATE = 420;

// Neon cyber palette
const BG_COLOR = "#050914";
const GRID_COLOR = "rgba(6, 182, 212, 0.06)"; // cyan grid
const GRID_SPACING = 48;

// Row-based neon alien colors (top to bottom)
const ALIEN_COLORS = ["#f72585", "#b5179e", "#7209b7", "#4361ee", "#06d6a0"];

// Power-up visual identity: [color, glyph, label]
const POWERUP_STYLE: Record<PowerUpKind, { color: string; glyph: string; label: string }> = {
  rapid: { color: "#facc15", glyph: "⚡", label: "RAPID" },
  spread: { color: "#22d3ee", glyph: "⋔", label: "SPREAD" },
  pierce: { color: "#a855f7", glyph: "◈", label: "PIERCE" },
  shield: { color: "#38bdf8", glyph: "🛡", label: "SHIELD" },
  life: { color: "#f87171", glyph: "♥", label: "1UP" },
};

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  ch: number,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, cw, ch);

  const scale = Math.min(cw / ARENA_W, ch / ARENA_H);
  const shx = (Math.random() * 2 - 1) * state.shake;
  const shy = (Math.random() * 2 - 1) * state.shake;
  const ox = (cw - ARENA_W * scale) / 2 + shx * scale;
  const oy = (ch - ARENA_H * scale) / 2 + shy * scale;
  ctx.setTransform(scale, 0, 0, scale, ox, oy);

  // Background fills
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // Cyber grid
  drawGrid(ctx);

  // Scanlines
  drawScanlines(ctx, ch, scale, oy);

  drawStars(ctx, state);
  drawShields(ctx, state);

  if (state.phase !== "attract") {
    drawAliens(ctx, state);
    drawSaucer(ctx, state);
    drawAlienBullets(ctx, state);
    drawPowerUps(ctx, state);
    drawShips(ctx, state);
    drawPlayerBullets(ctx, state);
  }

  drawParticles(ctx, state);
  drawHUD(ctx, state);
  drawOverlays(ctx, state);

  // Vignette
  drawVignette(ctx);
}

// ── Background ───────────────────────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;
  for (let x = GRID_SPACING; x < ARENA_W; x += GRID_SPACING) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_H);
    ctx.stroke();
  }
  for (let y = GRID_SPACING; y < ARENA_H; y += GRID_SPACING) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA_W, y);
    ctx.stroke();
  }
}

function drawScanlines(ctx: CanvasRenderingContext2D, ch: number, scale: number, oy: number): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
  const lineH = 2 / scale;
  for (let y = -oy / scale; y < ch / scale; y += lineH * 2) {
    ctx.fillRect(0, y * scale + oy, 9999, lineH * scale);
  }
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createRadialGradient(
    ARENA_W / 2,
    ARENA_H / 2,
    ARENA_H * 0.45,
    ARENA_W / 2,
    ARENA_H / 2,
    ARENA_H * 0.95,
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
}

// ── Stars ────────────────────────────────────────────────────────────────────

function drawStars(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const s of state.stars) {
    const alpha = s.brightness * (0.7 + 0.3 * Math.sin(state.attractBlink * 0.002 + s.x));
    // Random tint between blue and white
    const r = Math.floor(180 + 75 * s.brightness);
    const g = Math.floor(200 + 55 * s.brightness);
    const b = Math.floor(240 + 15 * s.brightness);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
}

// ── Ships ────────────────────────────────────────────────────────────────────

function drawShips(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.players) {
    if (p.respawnTimer > 0) continue;

    const alpha = p.invincibleTimer > 0 ? (Math.sin(state.attractBlink * 0.018) > 0 ? 1 : 0.15) : 1;

    ctx.globalAlpha = alpha;
    const cx = p.x;
    const sy = SHIP_Y;
    const w = SHIP_W;
    const h = SHIP_H;

    // Glow layer
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(cx, sy);
    ctx.lineTo(cx - w * 0.45, sy + h);
    ctx.lineTo(cx + w * 0.45, sy + h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Core ship (darker center, bright edges)
    const grad = ctx.createLinearGradient(cx, sy, cx, sy + h);
    grad.addColorStop(0, p.color);
    grad.addColorStop(0.7, darken(p.color, 0.5));
    grad.addColorStop(1, darken(p.color, 0.3));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, sy);
    ctx.lineTo(cx - w * 0.45, sy + h);
    ctx.lineTo(cx + w * 0.45, sy + h);
    ctx.closePath();
    ctx.fill();

    // Cockpit highlight
    ctx.fillStyle = brighten(p.color, 0.6);
    ctx.beginPath();
    ctx.moveTo(cx, sy + h * 0.2);
    ctx.lineTo(cx - w * 0.1, sy + h * 0.6);
    ctx.lineTo(cx + w * 0.1, sy + h * 0.6);
    ctx.closePath();
    ctx.fill();

    // Engine flame (animated)
    if (state.phase === "playing" || state.phase === "wavetransition") {
      const flameH = 6 + Math.random() * 8;
      const flameGrad = ctx.createLinearGradient(cx, sy + h, cx, sy + h + flameH);
      flameGrad.addColorStop(0, "#06d6a0");
      flameGrad.addColorStop(0.3, brighten(p.color, 0.4));
      flameGrad.addColorStop(1, "rgba(6,214,160,0)");
      ctx.fillStyle = flameGrad;
      ctx.fillRect(cx - 4, sy + h, 8, flameH);
    }

    // Shield bubble
    if (p.shieldTimer > 0) {
      const expiring = p.shieldTimer < 1500;
      const on = !expiring || Math.sin(state.attractBlink * 0.02) > -0.3;
      if (on) {
        const pulse = 1 + Math.sin(state.attractBlink * 0.01) * 0.08;
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7 * alpha;
        ctx.beginPath();
        ctx.ellipse(cx, sy + h * 0.6, w * 0.85 * pulse, h * 1.5 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.globalAlpha = 1;
  }
}

// ── Power-ups ─────────────────────────────────────────────────────────────────

function drawPowerUps(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const pu of state.powerUps) {
    const style = POWERUP_STYLE[pu.kind];
    const bob = Math.sin(state.attractBlink * 0.008 + pu.x) * 2;
    const x = pu.x;
    const y = pu.y + bob;
    const half = POWERUP_W / 2;

    // Glowing capsule
    ctx.save();
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(5, 9, 20, 0.85)";
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2;
    roundRect(ctx, x - half, y - POWERUP_H / 2, POWERUP_W, POWERUP_H, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Glyph
    ctx.save();
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = style.color;
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.glyph, x, y + 1);
    ctx.restore();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── Player bullets ───────────────────────────────────────────────────────────

function drawPlayerBullets(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.players) {
    if (p.bullet) drawPlayerBullet(ctx, p.bullet, p.color);
    for (const b of p.extraBullets) drawPlayerBullet(ctx, b, p.color);
  }
}

function drawPlayerBullet(ctx: CanvasRenderingContext2D, b: PlayerBullet, color: string): void {
  const bx = b.x;
  const by = b.y;
  // Piercing bullets glow purple regardless of ship color.
  const glow = b.piercing ? "#a855f7" : color;
  const tail = b.piercing ? "#a855f7" : color;
  const w = b.piercing ? PLAYER_BULLET_W + 2 : PLAYER_BULLET_W;

  // Glow
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = b.piercing ? 14 : 10;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bx - 1.5, by, 3, PLAYER_BULLET_H);
  ctx.restore();

  // Core
  const grad = ctx.createLinearGradient(bx, by, bx, by + PLAYER_BULLET_H);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, tail);
  ctx.fillStyle = grad;
  ctx.fillRect(bx - w / 2, by, w, PLAYER_BULLET_H);
}

// ── Aliens ───────────────────────────────────────────────────────────────────

function drawAliens(ctx: CanvasRenderingContext2D, state: GameState): void {
  const tick = Math.floor(state.attractBlink / ALIEN_FRAME_RATE) % 2;

  for (let row = 0; row < ALIEN_ROWS; row++) {
    for (let col = 0; col < ALIEN_COLS; col++) {
      const a = state.aliens[row]?.[col];
      if (!a || !a.alive) continue;

      const ax = state.alienGridX + col * (ALIEN_W + ALIEN_GAP_X);
      const ay = state.alienGridY + row * (ALIEN_H + ALIEN_GAP_Y);
      const color = ALIEN_COLORS[row % ALIEN_COLORS.length]!;

      // Glow
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      drawAlienShape(ctx, ax, ay, ALIEN_W, ALIEN_H, row, tick, color);
      ctx.restore();
    }
  }
}

function drawAlienShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  row: number,
  frame: number,
  color: string,
): void {
  const pw = w / 7;
  const ph = h / 7;
  const light = brighten(color, 0.4);

  let pixels: [number, number, string][] = []; // [px, py, color]

  if (row === 0) {
    // Squid — top row
    const body: [number, number][] =
      frame === 0
        ? [
            [0, 1],
            [6, 1],
            [1, 0],
            [2, 0],
            [4, 0],
            [5, 0],
            [0, 2],
            [1, 2],
            [2, 2],
            [4, 2],
            [5, 2],
            [6, 2],
            [1, 3],
            [2, 3],
            [4, 3],
            [5, 3],
            [0, 4],
            [2, 4],
            [4, 4],
            [6, 4],
            [1, 5],
            [3, 5],
            [5, 5],
            [0, 6],
            [2, 6],
            [4, 6],
            [6, 6],
          ]
        : [
            [1, 1],
            [5, 1],
            [0, 0],
            [3, 0],
            [6, 0],
            [0, 2],
            [1, 2],
            [2, 2],
            [4, 2],
            [5, 2],
            [6, 2],
            [0, 3],
            [2, 3],
            [4, 3],
            [6, 3],
            [1, 4],
            [3, 4],
            [5, 4],
            [0, 5],
            [2, 5],
            [4, 5],
            [6, 5],
            [1, 6],
            [3, 6],
            [5, 6],
          ];
    // Eyes
    const eyes: [number, number][] =
      frame === 0
        ? [
            [2, 1],
            [4, 1],
          ]
        : [
            [1, 1],
            [5, 1],
          ];
    for (const [px, py] of body) {
      const isEye = eyes.some(([ex, ey]) => ex === px && ey === py);
      pixels.push([px, py, isEye ? light : color]);
    }
  } else if (row <= 2) {
    // Crab
    const body: [number, number][] =
      frame === 0
        ? [
            [0, 0],
            [1, 0],
            [2, 0],
            [4, 0],
            [5, 0],
            [6, 0],
            [2, 1],
            [4, 1],
            [0, 2],
            [1, 2],
            [2, 2],
            [3, 2],
            [4, 2],
            [5, 2],
            [6, 2],
            [0, 3],
            [2, 3],
            [4, 3],
            [6, 3],
            [1, 4],
            [2, 4],
            [4, 4],
            [5, 4],
            [3, 5],
            [1, 6],
            [5, 6],
          ]
        : [
            [1, 0],
            [2, 0],
            [4, 0],
            [5, 0],
            [2, 1],
            [4, 1],
            [0, 2],
            [1, 2],
            [2, 2],
            [3, 2],
            [4, 2],
            [5, 2],
            [6, 2],
            [0, 3],
            [2, 3],
            [4, 3],
            [6, 3],
            [0, 4],
            [1, 4],
            [3, 4],
            [5, 4],
            [6, 4],
            [2, 5],
            [4, 5],
            [1, 6],
            [3, 6],
            [5, 6],
          ];
    const eyes: [number, number][] = [
      [2, 0],
      [4, 0],
    ];
    for (const [px, py] of body) {
      const isEye = eyes.some(([ex, ey]) => ex === px && ey === py);
      pixels.push([px, py, isEye ? light : color]);
    }
  } else {
    // Octopus
    const body: [number, number][] =
      frame === 0
        ? [
            [0, 0],
            [6, 0],
            [1, 1],
            [5, 1],
            [0, 2],
            [1, 2],
            [2, 2],
            [4, 2],
            [5, 2],
            [6, 2],
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3],
            [4, 3],
            [5, 3],
            [6, 3],
            [1, 4],
            [3, 4],
            [5, 4],
            [0, 5],
            [2, 5],
            [4, 5],
            [6, 5],
            [1, 6],
            [5, 6],
          ]
        : [
            [1, 0],
            [5, 0],
            [0, 1],
            [6, 1],
            [0, 2],
            [2, 2],
            [3, 2],
            [4, 2],
            [6, 2],
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3],
            [4, 3],
            [5, 3],
            [6, 3],
            [0, 4],
            [2, 4],
            [4, 4],
            [6, 4],
            [1, 5],
            [3, 5],
            [5, 5],
            [0, 6],
            [2, 6],
            [4, 6],
            [6, 6],
          ];
    const eyes: [number, number][] = [
      [1, 1],
      [5, 1],
    ];
    for (const [px, py] of body) {
      const isEye = eyes.some(([ex, ey]) => ex === px && ey === py);
      pixels.push([px, py, isEye ? light : color]);
    }
  }

  for (const [px, py, c] of pixels) {
    ctx.fillStyle = c;
    ctx.fillRect(x + px * pw, y + py * ph, pw, ph);
  }
}

// ── Alien bullets ────────────────────────────────────────────────────────────

function drawAlienBullets(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const ab of state.alienBullets) {
    const bx = ab.x;
    const by = ab.y;

    // Glow
    ctx.save();
    ctx.shadowColor = "#f72585";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#ff69b4";
    ctx.fillRect(bx - 2, by, 4, ALIEN_BULLET_H);
    ctx.restore();

    // Core
    const grad = ctx.createLinearGradient(bx, by, bx, by + ALIEN_BULLET_H);
    grad.addColorStop(0, "#f72585");
    grad.addColorStop(1, "#ff69b4");
    ctx.fillStyle = grad;
    ctx.fillRect(bx - ALIEN_BULLET_W / 2, by, ALIEN_BULLET_W, ALIEN_BULLET_H);
  }
}

// ── Shields ──────────────────────────────────────────────────────────────────

function drawShields(ctx: CanvasRenderingContext2D, state: GameState): void {
  const cellW = SHIELD_W / SHIELD_CELLS_X;
  const cellH = SHIELD_H / SHIELD_CELLS_Y;

  for (const shield of state.shields) {
    // Glow aura behind the shield
    ctx.save();
    ctx.shadowColor = "rgba(6, 182, 212, 0.5)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(6, 182, 212, 0.02)";
    ctx.fillRect(shield.x - 2, shield.y - 2, SHIELD_W + 4, SHIELD_H + 4);
    ctx.restore();

    for (let cx = 0; cx < SHIELD_CELLS_X; cx++) {
      for (let cy = 0; cy < SHIELD_CELLS_Y; cy++) {
        if (!shield.cells[cx]![cy]) continue;
        // Outer cells are dimmer
        const distX = Math.min(cx, SHIELD_CELLS_X - 1 - cx);
        const distY = Math.min(cy, SHIELD_CELLS_Y - 1 - cy);
        const edge = Math.min(distX / 2, distY / 2);
        const alpha = 0.3 + edge * 0.25;
        ctx.fillStyle = `rgba(6, 182, 212, ${alpha.toFixed(2)})`;
        ctx.fillRect(shield.x + cx * cellW + 1, shield.y + cy * cellH + 1, cellW - 2, cellH - 2);
      }
    }
  }
}

// ── Saucer ───────────────────────────────────────────────────────────────────

function drawSaucer(ctx: CanvasRenderingContext2D, state: GameState): void {
  const s = state.saucer;
  if (!s) return;

  const sx = s.x - SAUCER_W / 2;
  const sy = s.y - SAUCER_H / 2;
  const pulse = 1 + Math.sin(state.attractBlink * 0.006) * 0.15;

  // Outer glow
  ctx.save();
  ctx.shadowColor = "#f72585";
  ctx.shadowBlur = 20 * pulse;
  ctx.fillStyle = "rgba(247, 37, 133, 0.15)";
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, SAUCER_W / 2 + 8, SAUCER_H / 2 + 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Body
  ctx.fillStyle = "#f72585";
  ctx.fillRect(sx + SAUCER_W * 0.2, sy, SAUCER_W * 0.6, SAUCER_H * 0.45);
  ctx.fillRect(sx, sy + SAUCER_H * 0.35, SAUCER_W, SAUCER_H * 0.3);
  ctx.fillRect(sx + SAUCER_W * 0.1, sy + SAUCER_H * 0.6, SAUCER_W * 0.8, SAUCER_H * 0.2);

  // Cockpit glow
  ctx.fillStyle = brighten("#f72585", 0.5);
  ctx.fillRect(sx + SAUCER_W * 0.28, sy + SAUCER_H * 0.05, SAUCER_W * 0.44, SAUCER_H * 0.25);

  // Legs
  ctx.fillStyle = "#b5179e";
  ctx.fillRect(sx + SAUCER_W * 0.05, sy + SAUCER_H * 0.7, SAUCER_W * 0.1, SAUCER_H * 0.3);
  ctx.fillRect(sx + SAUCER_W * 0.85, sy + SAUCER_H * 0.7, SAUCER_W * 0.1, SAUCER_H * 0.3);

  // Points label with glow
  ctx.save();
  ctx.shadowColor = "#f72585";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#fff";
  ctx.font = `600 12px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(String(s.points), s.x, sy - 8);
  ctx.restore();
}

// ── Particles ────────────────────────────────────────────────────────────────

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.particles) {
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.globalAlpha = alpha;
    // Glow
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ── HUD ──────────────────────────────────────────────────────────────────────

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.phase === "attract") return;

  ctx.textBaseline = "top";

  // Player scores — top-left, stacked
  let sy = 10;
  for (const p of state.players) {
    ctx.textAlign = "left";
    const name = p.displayName.length > 8 ? p.displayName.slice(0, 8) : p.displayName;
    ctx.font = `600 19px ${FONT}`;

    // Text shadow
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = p.color;
    const label = `${name} ${p.score}`;
    ctx.fillText(label, 14, sy);
    ctx.restore();

    // Combo multiplier badge
    if (p.comboCount > 1) {
      const mult = Math.min(p.comboCount, 8);
      const metrics = ctx.measureText(label);
      ctx.save();
      const flash = 0.7 + 0.3 * Math.sin(state.attractBlink * 0.02);
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(250, 204, 21, ${flash.toFixed(2)})`;
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText(`x${mult}`, 14 + metrics.width + 10, sy + 1);
      ctx.restore();
    }

    // Active power-up chips
    drawBuffChips(ctx, p, 14, sy + 22);

    sy += hasActiveBuff(p) ? 44 : 22;
  }

  // Wave — top-right
  ctx.textAlign = "right";
  ctx.save();
  ctx.shadowColor = "#06d6a0";
  ctx.shadowBlur = 6;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = "#06d6a0";
  ctx.fillText(`WAVE ${state.wave}`, ARENA_W - 14, 12);
  ctx.restore();

  // Lives — bottom
  let lx = 12;
  const ly = ARENA_H - 20;
  for (const p of state.players) {
    for (let i = 0; i < p.lives; i++) {
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5;
      ctx.fillStyle = p.color;
      ctx.fillRect(lx, ly, 12, 8);
      ctx.restore();
      // Tiny engine dot
      ctx.fillStyle = "#06d6a0";
      ctx.fillRect(lx + 5, ly + 8, 2, 3);
      lx += 17;
    }
    lx += 10;
  }
}

function hasActiveBuff(p: ShipState): boolean {
  return p.rapidTimer > 0 || p.spreadTimer > 0 || p.pierceTimer > 0 || p.shieldTimer > 0;
}

/** Draws small timed chips for each active buff a player holds. */
function drawBuffChips(ctx: CanvasRenderingContext2D, p: ShipState, x: number, y: number): void {
  const chips: { kind: PowerUpKind; frac: number }[] = [];
  if (p.rapidTimer > 0) chips.push({ kind: "rapid", frac: p.rapidTimer / POWERUP_DURATION_MS });
  if (p.spreadTimer > 0) chips.push({ kind: "spread", frac: p.spreadTimer / POWERUP_DURATION_MS });
  if (p.pierceTimer > 0) chips.push({ kind: "pierce", frac: p.pierceTimer / POWERUP_DURATION_MS });
  if (p.shieldTimer > 0) chips.push({ kind: "shield", frac: p.shieldTimer / SHIELD_DURATION_MS });

  const chipW = 26;
  const chipH = 16;
  let cx = x;
  for (const chip of chips) {
    const style = POWERUP_STYLE[chip.kind];
    // Background
    ctx.fillStyle = "rgba(5, 9, 20, 0.7)";
    roundRect(ctx, cx, y, chipW, chipH, 4);
    ctx.fill();
    // Countdown fill
    ctx.fillStyle = style.color;
    ctx.globalAlpha = 0.25;
    roundRect(ctx, cx, y, chipW * Math.max(0, Math.min(1, chip.frac)), chipH, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Glyph
    ctx.fillStyle = style.color;
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.glyph, cx + chipW / 2, y + chipH / 2 + 1);
    cx += chipW + 4;
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
}

// ── Overlays ─────────────────────────────────────────────────────────────────

function drawOverlays(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (state.phase === "attract") {
    // Pulsing title with neon glow
    const pulse = 1 + Math.sin(state.attractBlink * 0.003) * 0.04;
    const titleSize = Math.round(96 * pulse);

    ctx.save();
    ctx.shadowColor = "#f72585";
    ctx.shadowBlur = 30;
    ctx.font = `700 ${titleSize}px ${FONT}`;
    ctx.fillStyle = "#f72585";
    ctx.fillText("SPACE", ARENA_W / 2, ARENA_H / 2 - 60);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "#06d6a0";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#06d6a0";
    ctx.fillText("INVADERS", ARENA_W / 2, ARENA_H / 2 + 40);
    ctx.restore();

    // Subtitle
    ctx.save();
    ctx.shadowColor = "rgba(6, 182, 212, 0.5)";
    ctx.shadowBlur = 10;
    ctx.font = `600 28px ${FONT}`;
    ctx.fillStyle = "rgba(6, 182, 212, 0.9)";
    ctx.fillText("Press Fire to play", ARENA_W / 2, ARENA_H / 2 + 120);
    ctx.restore();

    // Controls
    ctx.font = `400 15px ${FONT}`;
    ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
    const count = state.players.length;
    const lines: string[] = [];
    if (count >= 1) lines.push("P1: A/D + Space");
    if (count >= 2) lines.push("P2: ← → + Numpad0");
    if (count >= 3) lines.push("P3: Numpad4/6 + NumpadEnter");
    if (count >= 4) lines.push("P4: F/H + Tab");
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i]!, ARENA_W / 2, ARENA_H / 2 + 155 + i * 20);
    }

    // Power-up legend
    drawPowerUpLegend(ctx, ARENA_H / 2 + 165 + lines.length * 20);

    // Decorative alien lineup
    drawDecoAliens(ctx, state);
  } else if (state.phase === "wavetransition" && state.waveBannerTimer > 0) {
    const progress = 1 - state.waveBannerTimer / 1800;
    const scale = 1 + Math.sin(progress * Math.PI) * 0.35;
    const size = Math.round(72 * scale);

    ctx.save();
    ctx.shadowColor = "#06d6a0";
    ctx.shadowBlur = 24;
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.fillStyle = "#06d6a0";
    ctx.fillText(`WAVE ${state.wave}`, ARENA_W / 2, ARENA_H / 2);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "rgba(6, 214, 160, 0.4)";
    ctx.shadowBlur = 8;
    ctx.font = `500 22px ${FONT}`;
    ctx.fillStyle = "rgba(6, 214, 160, 0.7)";
    ctx.fillText("GET READY", ARENA_W / 2, ARENA_H / 2 + 60);
    ctx.restore();
  } else if (state.phase === "gameover") {
    if (state.victory) {
      const pulse = 1 + Math.sin(state.attractBlink * 0.004) * 0.06;
      const size = Math.round(64 * pulse);

      ctx.save();
      ctx.shadowColor = "#06d6a0";
      ctx.shadowBlur = 30;
      ctx.font = `700 ${size}px ${FONT}`;
      ctx.fillStyle = "#06d6a0";
      ctx.fillText("VICTORY!", ARENA_W / 2, ARENA_H / 2 - 50);
      ctx.restore();

      ctx.save();
      ctx.shadowColor = "rgba(6, 214, 160, 0.3)";
      ctx.shadowBlur = 8;
      ctx.font = `500 22px ${FONT}`;
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`All ${state.wave} waves cleared!`, ARENA_W / 2, ARENA_H / 2 + 10);
      ctx.restore();
    } else {
      ctx.save();
      ctx.shadowColor = "#f72585";
      ctx.shadowBlur = 30;
      ctx.font = "700 60px " + FONT;
      ctx.fillStyle = "#f72585";
      ctx.fillText("GAME OVER", ARENA_W / 2, ARENA_H / 2 - 30);
      ctx.restore();

      ctx.save();
      ctx.shadowColor = "rgba(247, 37, 133, 0.3)";
      ctx.shadowBlur = 8;
      ctx.font = `500 22px ${FONT}`;
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Reached wave ${state.wave}`, ARENA_W / 2, ARENA_H / 2 + 20);
      ctx.restore();
    }

    // Player scores
    ctx.font = `600 20px ${FONT}`;
    let sy = ARENA_H / 2 + 70;
    for (const p of state.players) {
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.fillText(`${p.displayName}: ${p.score}`, ARENA_W / 2, sy);
      ctx.restore();
      sy += 30;
    }
  }
}

function drawPowerUpLegend(ctx: CanvasRenderingContext2D, y: number): void {
  const kinds: PowerUpKind[] = ["rapid", "spread", "pierce", "shield", "life"];
  const spacing = 150;
  const totalW = (kinds.length - 1) * spacing;
  const startX = ARENA_W / 2 - totalW / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < kinds.length; i++) {
    const style = POWERUP_STYLE[kinds[i]!];
    const x = startX + i * spacing;

    ctx.shadowColor = style.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = style.color;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(style.glyph, x - 42, y);

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(203, 213, 225, 0.75)";
    ctx.font = `500 14px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(style.label, x - 30, y);
    ctx.textAlign = "center";
  }
  ctx.restore();
}

function drawDecoAliens(ctx: CanvasRenderingContext2D, state: GameState): void {
  const tick = Math.floor(state.attractBlink / ALIEN_FRAME_RATE) % 2;
  const rows = [0, 1, 1, 3, 3];
  const gridX = 200;
  const gridY = ARENA_H / 2 - 240;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 11; col++) {
      const ax = gridX + col * (ALIEN_W + ALIEN_GAP_X);
      const ay = gridY + row * (ALIEN_H + ALIEN_GAP_Y);
      const color = ALIEN_COLORS[row % ALIEN_COLORS.length]!;

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      drawAlienShape(ctx, ax, ay, ALIEN_W, ALIEN_H, rows[row]!, tick, color);
      ctx.restore();
    }
  }
}

// ── Color helpers ────────────────────────────────────────────────────────────

function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * (1 - amount))},${Math.round(g * (1 - amount))},${Math.round(b * (1 - amount))})`;
}

function brighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, Math.round(r + (255 - r) * amount))},${Math.min(255, Math.round(g + (255 - g) * amount))},${Math.min(255, Math.round(b + (255 - b) * amount))})`;
}
