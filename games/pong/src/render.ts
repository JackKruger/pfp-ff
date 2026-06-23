import {
  ARENA_H,
  ARENA_W,
  BALL_SIZE,
  PADDLE_H,
  PADDLE_MARGIN,
  PADDLE_W,
  type GameState,
} from "./game.js";
import { IMG, ready, tinted } from "./assets.js";

const FONT = "'Segoe UI', system-ui, sans-serif";
const GLYPH_W = 96;
const GLYPH_H = 128;

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  ch: number,
): void {
  // Letterbox fit + screen shake.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#05060a";
  ctx.fillRect(0, 0, cw, ch);

  const scale = Math.min(cw / ARENA_W, ch / ARENA_H);
  const shx = (Math.random() * 2 - 1) * state.shake;
  const shy = (Math.random() * 2 - 1) * state.shake;
  const ox = (cw - ARENA_W * scale) / 2 + shx * scale;
  const oy = (ch - ARENA_H * scale) / 2 + shy * scale;
  ctx.setTransform(scale, 0, 0, scale, ox, oy);

  drawBackground(ctx);
  drawGoalFlash(ctx, state);
  drawCenterNet(ctx);
  drawScores(ctx, state);
  drawTrail(ctx, state);
  drawBall(ctx, state);
  drawPaddles(ctx, state);
  drawParticles(ctx, state);
  drawOverlays(ctx, state);
  drawScreenFx(ctx);
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  if (ready(IMG.bg)) {
    ctx.drawImage(IMG.bg, 0, 0, ARENA_W, ARENA_H);
  } else {
    ctx.fillStyle = "#0b1022";
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }
}

function drawCenterNet(ctx: CanvasRenderingContext2D): void {
  if (ready(IMG.net)) {
    ctx.drawImage(
      IMG.net,
      ARENA_W / 2 - IMG.net.naturalWidth / 2,
      0,
      IMG.net.naturalWidth,
      ARENA_H,
    );
    return;
  }
  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 22]);
  ctx.beginPath();
  ctx.moveTo(ARENA_W / 2, 0);
  ctx.lineTo(ARENA_W / 2, ARENA_H);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGoalFlash(ctx: CanvasRenderingContext2D, state: GameState): void {
  const side = state.flashSide;
  if (state.flashTimer <= 0 || (side !== 0 && side !== 1)) return;
  const player = state.players[side];
  const alpha = Math.min(1, state.flashTimer / 520) * 0.8;
  ctx.globalAlpha = alpha;
  if (ready(IMG.goalFlash)) {
    const w = IMG.goalFlash.naturalWidth;
    const tex = tinted(IMG.goalFlash, player.color);
    if (side === 0) {
      ctx.drawImage(tex, 0, 0, w, ARENA_H);
    } else {
      ctx.save();
      ctx.translate(ARENA_W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(tex, 0, 0, w, ARENA_H);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = player.color;
    const w = 120;
    ctx.fillRect(side === 0 ? 0 : ARENA_W - w, 0, w, ARENA_H);
  }
  ctx.globalAlpha = 1;
}

function drawScores(ctx: CanvasRenderingContext2D, state: GameState): void {
  const [left, right] = state.players;
  drawNumber(ctx, left.score, ARENA_W / 2 - 130, 44, 0.8, left.color);
  drawNumber(ctx, right.score, ARENA_W / 2 + 130, 44, 0.8, right.color);
}

function drawNumber(
  ctx: CanvasRenderingContext2D,
  value: number,
  centerX: number,
  top: number,
  scale: number,
  color: string,
): void {
  const text = String(value);
  if (!ready(IMG.digits)) {
    ctx.font = `700 ${Math.round(GLYPH_H * scale)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = color;
    ctx.fillText(text, centerX, top);
    return;
  }
  const gw = GLYPH_W * scale;
  const gh = GLYPH_H * scale;
  const sheet = tinted(IMG.digits, color);
  let x = centerX - (text.length * gw) / 2;
  for (const ch of text) {
    const d = ch.charCodeAt(0) - 48;
    ctx.drawImage(sheet, d * GLYPH_W, 0, GLYPH_W, GLYPH_H, x, top, gw, gh);
    x += gw;
  }
}

function drawTrail(ctx: CanvasRenderingContext2D, state: GameState): void {
  const n = state.trail.length;
  if (n === 0) return;
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const p = state.trail[i];
    const a = ((i + 1) / n) * 0.4;
    const s = BALL_SIZE * (1.2 + (i / n) * 1.6);
    ctx.globalAlpha = a;
    if (ready(IMG.ball)) {
      ctx.drawImage(IMG.ball, p.x - s / 2, p.y - s / 2, s, s);
    } else {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(p.x - s / 4, p.y - s / 4, s / 2, s / 2);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawBall(ctx: CanvasRenderingContext2D, state: GameState): void {
  const cx = state.ball.x + BALL_SIZE / 2;
  const cy = state.ball.y + BALL_SIZE / 2;
  if (ready(IMG.ball)) {
    const s = BALL_SIZE * 2.6;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(IMG.ball, cx - s / 2, cy - s / 2, s, s);
    ctx.globalCompositeOperation = "source-over";
  } else {
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(state.ball.x, state.ball.y, BALL_SIZE, BALL_SIZE);
  }
}

function drawPaddles(ctx: CanvasRenderingContext2D, state: GameState): void {
  const [left, right] = state.players;
  drawPaddle(ctx, PADDLE_MARGIN, left.paddleY, left.color);
  drawPaddle(ctx, ARENA_W - PADDLE_MARGIN - PADDLE_W, right.paddleY, right.color);
}

function drawPaddle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  if (ready(IMG.paddle)) {
    ctx.drawImage(tinted(IMG.paddle, color), x, y, PADDLE_W, PADDLE_H);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, PADDLE_W, PADDLE_H);
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  const haveSpark = ready(IMG.spark);
  if (haveSpark) ctx.globalCompositeOperation = "lighter";
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    if (haveSpark) {
      const s = p.size * 4;
      ctx.drawImage(tinted(IMG.spark, p.color), p.x - s / 2, p.y - s / 2, s, s);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawScreenFx(ctx: CanvasRenderingContext2D): void {
  if (ready(IMG.scanlines)) {
    const pat = ctx.createPattern(IMG.scanlines, "repeat");
    if (pat) {
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
      ctx.globalAlpha = 1;
    }
  }
  if (ready(IMG.vignette)) {
    ctx.drawImage(IMG.vignette, 0, 0, ARENA_W, ARENA_H);
  }
}

function drawOverlays(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (state.phase === "attract") {
    if (ready(IMG.wordmark)) {
      const w = 720;
      const h = (w / IMG.wordmark.naturalWidth) * IMG.wordmark.naturalHeight;
      ctx.drawImage(IMG.wordmark, ARENA_W / 2 - w / 2, ARENA_H / 2 - h - 10, w, h);
    } else {
      banner(ctx, "PONG", "#f8fafc", 120, ARENA_H / 2 - 60);
    }
    banner(ctx, "Press Fire to play", "rgba(226,232,240,0.9)", 38, ARENA_H / 2 + 70);
    banner(ctx, "P1: W / S      P2: ↑ / ↓", "rgba(148,163,184,0.7)", 26, ARENA_H / 2 + 128);
  } else if (state.phase === "serving" && state.serveTimer > 0) {
    banner(ctx, String(Math.ceil(state.serveTimer / 1000)), "#f8fafc", 140, ARENA_H / 2);
  } else if (state.phase === "gameover" && state.winner) {
    banner(ctx, `${state.winner.displayName} wins!`, state.winner.color, 96, ARENA_H / 2);
  }
}

function banner(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  size: number,
  y: number,
): void {
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, ARENA_W / 2, y);
}
