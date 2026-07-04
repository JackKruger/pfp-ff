import { LOGICAL_H, LOGICAL_W, PLAYER_H, PLAYER_W } from "../constants.js";
import { probePlacement } from "../phases/placement.js";
import { bladeTip, raceElapsedMs, sweeperCenter } from "../phases/race.js";
import { pieceAabb, PIECES } from "../pieces/registry.js";
import { ARENAS } from "../arenas/index.js";
import type { GameState } from "../types.js";
import { arenaBg, IMG, pieceImage, ready, SHEET, type Sheet, tinted } from "./assets.js";
import { type CameraState, lerpCamera, makeCamera, targetFor } from "./camera.js";
import { drawHud } from "./hud.js";

export class Renderer {
  private camera: CameraState = makeCamera();

  constructor(private ctx: CanvasRenderingContext2D) {}

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    const canvas = this.ctx.canvas;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(state: GameState): void {
    const cw = this.ctx.canvas.width / (window.devicePixelRatio || 1);
    const ch = this.ctx.canvas.height / (window.devicePixelRatio || 1);

    // Background
    this.ctx.fillStyle = "#05060a";
    this.ctx.fillRect(0, 0, cw, ch);

    // Pre-match arena picker is a full-screen menu, not a world view.
    if (state.phase === "levelSelect") {
      this.drawLevelSelect(state, cw, ch);
      return;
    }

    // Camera transform (logical 1280x720 maps to canvas)
    this.camera = lerpCamera(this.camera, targetFor(state));

    this.ctx.save();
    const shake = state.screenShake ?? 0;
    if (shake > 0.1) {
      this.ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    const scaleX = cw / LOGICAL_W;
    const scaleY = ch / LOGICAL_H;
    const fit = Math.min(scaleX, scaleY);
    this.ctx.translate(cw / 2, ch / 2);
    this.ctx.scale(fit * this.camera.zoom, fit * this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);

    this.drawArena(state);
    if (state.phase === "placement") this.drawPlacementGrid(state);
    this.drawPieces(state);
    this.drawRevealHighlights(state);
    this.drawArenaDynamics(state);
    this.drawGoalPulses(state);
    this.drawParticles(state);
    this.drawActors(state);
    this.drawCursors(state);
    this.drawFloats(state);

    this.ctx.restore();

    drawHud(this.ctx, state, cw, ch);
  }

  private drawLevelSelect(state: GameState, cw: number, ch: number): void {
    const ctx = this.ctx;
    const idx = state.levelSelectIdx ?? 0;
    const arena = state.arena;
    ctx.textAlign = "center";

    // Wordmark logo if present, else a text title.
    if (ready(IMG.wordmark)) {
      const ww = Math.min(cw * 0.42, 380);
      const wh = ww * (IMG.wordmark.naturalHeight / IMG.wordmark.naturalWidth);
      ctx.drawImage(IMG.wordmark, cw / 2 - ww / 2, ch * 0.04, ww, wh);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "600 18px system-ui, sans-serif";
      ctx.fillText("Choose your arena", cw / 2, ch * 0.2);
    } else {
      ctx.fillStyle = "#f59e0b";
      ctx.font = "700 34px system-ui, sans-serif";
      ctx.fillText("CHOOSE YOUR ARENA", cw / 2, ch * 0.16);
    }

    // Preview box — arena art (cover-fit) or palette gradient fallback.
    const pw = Math.min(cw * 0.6, 720);
    const ph = pw * 0.5;
    const px = cw / 2 - pw / 2;
    const py = ch * 0.26;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    const bg = arenaBg(arena.id);
    if (ready(bg)) {
      const scale = Math.max(pw / bg.naturalWidth, ph / bg.naturalHeight);
      const dw = bg.naturalWidth * scale;
      const dh = bg.naturalHeight * scale;
      ctx.drawImage(bg, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
    } else if (arena.bg) {
      const g = ctx.createLinearGradient(0, py, 0, py + ph);
      g.addColorStop(0, arena.bg.top);
      g.addColorStop(1, arena.bg.bottom);
      ctx.fillStyle = g;
      ctx.fillRect(px, py, pw, ph);
    } else {
      ctx.fillStyle = "#1a2030";
      ctx.fillRect(px, py, pw, ph);
    }
    ctx.restore();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.strokeRect(px, py, pw, ph);

    // Arrows + arena name above the preview.
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.fillText(`◄   ${arena.name}   ►`, cw / 2, py - 16);

    // Index dots + counter below the preview.
    const n = ARENAS.length;
    const dotY = py + ph + 34;
    const gap = 22;
    const startX = cw / 2 - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * gap, dotY, 6, 0, Math.PI * 2);
      ctx.fillStyle = i === idx ? "#f59e0b" : "#3a3f4b";
      ctx.fill();
    }
    ctx.fillStyle = "#9ca3af";
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.fillText(`${idx + 1}/${n}`, cw / 2, dotY + 26);

    // Hint
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.fillText("Any player:   ◄ ►  cycle   ·   A  start", cw / 2, ch * 0.9);

    ctx.textAlign = "start";
  }

  private drawArena(state: GameState): void {
    const { arena } = state;

    // Background art if this arena has it; otherwise the palette gradient.
    const bgImg = arenaBg(arena.id);
    if (ready(bgImg)) {
      this.ctx.drawImage(bgImg, arena.bounds.x, arena.bounds.y, arena.bounds.w, arena.bounds.h);
    } else if (arena.bg) {
      const g = this.ctx.createLinearGradient(
        0,
        arena.bounds.y,
        0,
        arena.bounds.y + arena.bounds.h,
      );
      g.addColorStop(0, arena.bg.top);
      g.addColorStop(1, arena.bg.bottom);
      this.ctx.fillStyle = g;
      this.ctx.fillRect(arena.bounds.x, arena.bounds.y, arena.bounds.w, arena.bounds.h);
    }

    // Arena bounds outline (helps the eye locate edges in programmer-art).
    this.ctx.strokeStyle = "#1a2030";
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(arena.bounds.x, arena.bounds.y, arena.bounds.w, arena.bounds.h);

    // Solids
    this.ctx.fillStyle = "#2a3b56";
    for (const s of arena.solids) this.ctx.fillRect(s.x, s.y, s.w, s.h);

    // One-way drop-through platforms — striped to look clearly different.
    if (arena.oneWaySolids) {
      for (const o of arena.oneWaySolids) {
        this.ctx.fillStyle = "#475569";
        this.ctx.fillRect(o.x, o.y, o.w, o.h);
        this.ctx.strokeStyle = "#94a3b8";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let x = o.x + 6; x < o.x + o.w; x += 8) {
          this.ctx.moveTo(x, o.y);
          this.ctx.lineTo(x + 4, o.y + o.h);
        }
        this.ctx.stroke();
      }
    }

    // Start zone
    this.ctx.fillStyle = "rgba(34,197,94,0.18)";
    this.ctx.fillRect(arena.start.x - 32, arena.start.y - 64, 64, 64);

    // Goal
    this.ctx.fillStyle = "rgba(245,158,11,0.25)";
    this.ctx.fillRect(arena.goal.x, arena.goal.y, arena.goal.w, arena.goal.h);
    this.ctx.strokeStyle = "#f59e0b";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(arena.goal.x, arena.goal.y, arena.goal.w, arena.goal.h);

    // Kill-line
    this.ctx.strokeStyle = "#ef4444";
    this.ctx.setLineDash([8, 8]);
    this.ctx.beginPath();
    this.ctx.moveTo(arena.bounds.x, arena.killLineY);
    this.ctx.lineTo(arena.bounds.x + arena.bounds.w, arena.killLineY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  private drawPieces(state: GameState): void {
    const now = Date.now();
    const inRace = state.phase === "race";
    const elapsed = inRace ? raceElapsedMs(state) : 0;

    for (const p of state.pieces) {
      if (state.phase === "placement" && p.placedBy >= 0 && p.placedRound === state.round) {
        continue;
      }
      const def = PIECES[p.pieceId];
      const aabb = pieceAabb(p);

      // Scorer shimmer — soft alpha pulse so coins read as alive.
      if (p.pieceId === "coin" || p.pieceId === "diamond") {
        const phase = (now / 250 + p.uid * 0.7) % (Math.PI * 2);
        const pulse = 0.65 + 0.35 * Math.sin(phase);
        this.ctx.globalAlpha = pulse;
        const spin = SHEET.coinSpin;
        if (p.pieceId === "coin" && ready(spin.img)) {
          const fw = spin.img.naturalWidth / spin.frames;
          const fh = spin.img.naturalHeight;
          const f = Math.floor(now / 80 + p.uid) % spin.frames;
          this.ctx.drawImage(spin.img, f * fw, 0, fw, fh, aabb.x, aabb.y, aabb.w, aabb.h);
        } else if (p.pieceId === "coin" && ready(IMG.coin)) {
          this.ctx.drawImage(IMG.coin, aabb.x, aabb.y, aabb.w, aabb.h);
        } else if (p.pieceId === "diamond" && ready(IMG.diamond)) {
          this.ctx.drawImage(IMG.diamond, aabb.x, aabb.y, aabb.w, aabb.h);
        } else {
          this.ctx.fillStyle = colorForPiece(p.pieceId);
          this.ctx.beginPath();
          const r = aabb.w / 2;
          this.ctx.arc(aabb.x + r, aabb.y + r, r, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
        continue;
      }

      // Saw — spin the sprite if we have it, else the procedural gear-disc.
      if (p.pieceId === "saw") {
        const angle = (elapsed / 600 + p.uid * 0.3) * Math.PI * 2;
        if (ready(IMG.saw)) this.drawRotated(IMG.saw, aabb, def.w, def.h, angle);
        else this.drawSaw(aabb, angle);
        continue;
      }

      if (p.pieceId === "stairs") {
        this.drawStairs(aabb, p.rot);
        continue;
      }
      if (p.pieceId === "honey") {
        this.drawHoney(aabb);
        continue;
      }
      if (p.pieceId === "crumble") {
        const breaking = state.runtime.get(p.uid)?.state;
        this.drawCrumble(aabb, breaking === "crumbling" || breaking === "breaking");
        continue;
      }
      if (p.pieceId === "lowGravity" || p.pieceId === "slipperyWorld") {
        this.drawModifierToken(aabb, p.pieceId);
        continue;
      }

      // Static sprite (plank/block/spike) rotated to its placement, else a rect.
      const img = pieceImage(p.pieceId);
      if (ready(img)) {
        this.drawRotated(img, aabb, def.w, def.h, (p.rot * Math.PI) / 2);
        continue;
      }

      this.ctx.fillStyle = colorForPiece(p.pieceId);
      this.ctx.fillRect(aabb.x, aabb.y, aabb.w, aabb.h);
      if (def.lethal) {
        this.ctx.strokeStyle = "#ef4444";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(aabb.x, aabb.y, aabb.w, aabb.h);
      }
    }
  }

  private drawRevealHighlights(state: GameState): void {
    if (state.phase !== "race") return;
    const elapsed = raceElapsedMs(state);
    if (elapsed > 1100) return;
    const t = elapsed / 1100;
    const alpha = 1 - t;
    for (const p of state.pieces) {
      if (p.placedBy < 0 || p.placedRound !== state.round) continue;
      const aabb = pieceAabb(p);
      const cx = aabb.x + aabb.w / 2;
      const cy = aabb.y + aabb.h / 2;
      const r = Math.max(aabb.w, aabb.h) * (0.65 + t * 0.55);
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.strokeStyle = "#fbbf24";
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  /**
   * Draw a sprite centered in `aabb`, rotated by `angle`. `w`/`h` are the
   * sprite's unrotated logical size, so a 90°-placed piece whose AABB has w/h
   * swapped still draws at the right footprint.
   */
  private drawRotated(
    img: CanvasImageSource,
    aabb: { x: number; y: number; w: number; h: number },
    w: number,
    h: number,
    angle: number,
  ): void {
    this.ctx.save();
    this.ctx.translate(aabb.x + aabb.w / 2, aabb.y + aabb.h / 2);
    this.ctx.rotate(angle);
    this.ctx.drawImage(img, -w / 2, -h / 2, w, h);
    this.ctx.restore();
  }

  /**
   * Draw one frame of a tinted sprite-sheet strip, centered at (cx, cy) and
   * scaled to `size`. `facing < 0` mirrors horizontally. Returns false (so the
   * caller can fall back) if the sheet image hasn't loaded yet.
   */
  private drawSheet(
    sheet: Sheet,
    frame: number,
    color: string,
    cx: number,
    cy: number,
    size: number,
    facing: number,
  ): boolean {
    const img = sheet.img;
    if (!ready(img)) return false;
    const fw = img.naturalWidth / sheet.frames;
    const fh = img.naturalHeight;
    const idx = ((Math.floor(frame) % sheet.frames) + sheet.frames) % sheet.frames;
    const canvas = tinted(img, color);
    this.ctx.save();
    this.ctx.translate(cx, cy);
    if (facing < 0) this.ctx.scale(-1, 1);
    this.ctx.drawImage(canvas, idx * fw, 0, fw, fh, -size / 2, -size / 2, size, size);
    this.ctx.restore();
    return true;
  }

  /** Subtle tiled snap-grid over the arena during placement. */
  private drawPlacementGrid(state: GameState): void {
    if (!ready(IMG.grid)) return;
    const pattern = this.ctx.createPattern(IMG.grid, "repeat");
    if (!pattern) return;
    const b = state.arena.bounds;
    this.ctx.save();
    this.ctx.globalAlpha = 0.22;
    this.ctx.fillStyle = pattern;
    this.ctx.fillRect(b.x, b.y, b.w, b.h);
    this.ctx.restore();
  }

  private drawSaw(aabb: { x: number; y: number; w: number; h: number }, angle: number): void {
    const cx = aabb.x + aabb.w / 2;
    const cy = aabb.y + aabb.h / 2;
    const rOuter = aabb.w / 2;
    const rInner = rOuter * 0.55;
    const teeth = 8;
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(angle);
    this.ctx.fillStyle = "#dc2626";
    this.ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const a = (i * Math.PI) / teeth;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.closePath();
    this.ctx.fill();
    // Hub
    this.ctx.fillStyle = "#1f2937";
    this.ctx.beginPath();
    this.ctx.arc(0, 0, rOuter * 0.25, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawStairs(aabb: { x: number; y: number; w: number; h: number }, rot: number): void {
    this.ctx.save();
    this.ctx.translate(aabb.x + aabb.w / 2, aabb.y + aabb.h / 2);
    this.ctx.rotate((rot * Math.PI) / 2);
    const w = rot % 2 === 0 ? aabb.w : aabb.h;
    const h = rot % 2 === 0 ? aabb.h : aabb.w;
    this.ctx.translate(-w / 2, -h / 2);
    this.ctx.fillStyle = "#a8a29e";
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const sw = w / steps;
      const sh = (h / steps) * (i + 1);
      this.ctx.fillRect(i * sw, h - sh, sw, sh);
    }
    this.ctx.strokeStyle = "#57534e";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, w, h);
    this.ctx.restore();
  }

  private drawHoney(aabb: { x: number; y: number; w: number; h: number }): void {
    this.ctx.fillStyle = "#f59e0b";
    this.ctx.fillRect(aabb.x, aabb.y, aabb.w, aabb.h);
    this.ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let x = aabb.x + 6; x < aabb.x + aabb.w; x += 18) {
      this.ctx.beginPath();
      this.ctx.arc(x, aabb.y + aabb.h / 2, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawCrumble(aabb: { x: number; y: number; w: number; h: number }, breaking: boolean): void {
    this.ctx.fillStyle = breaking ? "#d97706" : "#78716c";
    this.ctx.fillRect(aabb.x, aabb.y, aabb.w, aabb.h);
    this.ctx.strokeStyle = breaking ? "#fbbf24" : "#44403c";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(aabb.x + aabb.w * 0.25, aabb.y + 2);
    this.ctx.lineTo(aabb.x + aabb.w * 0.35, aabb.y + aabb.h - 2);
    this.ctx.moveTo(aabb.x + aabb.w * 0.62, aabb.y + 2);
    this.ctx.lineTo(aabb.x + aabb.w * 0.55, aabb.y + aabb.h - 2);
    this.ctx.stroke();
  }

  private drawModifierToken(
    aabb: { x: number; y: number; w: number; h: number },
    id: "lowGravity" | "slipperyWorld",
  ): void {
    const cx = aabb.x + aabb.w / 2;
    const cy = aabb.y + aabb.h / 2;
    this.ctx.fillStyle = id === "lowGravity" ? "#8b5cf6" : "#38bdf8";
    circle(this.ctx, cx, cy, Math.min(aabb.w, aabb.h) / 2);
    this.ctx.strokeStyle = "#e2e8f0";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    if (id === "lowGravity") {
      this.ctx.arc(cx, cy, aabb.w * 0.22, Math.PI * 0.25, Math.PI * 1.7);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(cx + 8, cy - 14);
      this.ctx.lineTo(cx + 16, cy - 8);
      this.ctx.lineTo(cx + 6, cy - 4);
    } else {
      this.ctx.moveTo(cx - 16, cy + 8);
      this.ctx.bezierCurveTo(cx - 8, cy - 8, cx + 8, cy + 22, cx + 16, cy + 2);
    }
    this.ctx.stroke();
  }

  private drawActors(state: GameState): void {
    for (const actor of state.actors) {
      const player = state.players.find((p) => p.slot === actor.slot);
      const color = player?.color ?? "#cccccc";

      // Motion trail — last N positions, oldest faintest.
      if (actor.alive && !actor.finished && actor.trail?.length) {
        const len = actor.trail.length;
        for (let i = 0; i < len; i++) {
          const alpha = ((i + 1) / (len + 1)) * 0.35;
          this.ctx.globalAlpha = alpha;
          this.ctx.fillStyle = color;
          this.ctx.beginPath();
          this.ctx.arc(actor.trail[i].x, actor.trail[i].y, 3 + (i / len) * 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
      }

      if (!actor.alive && actor.deathPos) {
        const cx = actor.deathPos.x + PLAYER_W / 2;
        const cy = actor.deathPos.y + PLAYER_H / 2;
        this.ctx.globalAlpha = 0.6;
        if (ready(IMG.skull)) {
          const s = 28;
          this.ctx.drawImage(tinted(IMG.skull, color), cx - s / 2, cy - s / 2, s, s);
        } else {
          // Fallback skull glyph: filled circle.
          this.ctx.fillStyle = color;
          this.ctx.globalAlpha = 0.4;
          circle(this.ctx, cx, cy, 12);
        }
        this.ctx.globalAlpha = 1;
        continue;
      }
      if (!actor.alive) continue;

      // Live player: animated chicken (run/jump/idle), else a filled circle.
      const cx = actor.x + PLAYER_W / 2;
      const cy = actor.y + PLAYER_H / 2;
      const s = PLAYER_W + 12;
      const facing = actor.vx < -8 ? -1 : 1;
      const grounded = actor.contact === "ground";
      let sheet = SHEET.chickenIdle;
      let frame = 0;
      if (!grounded) {
        sheet = SHEET.chickenJump;
        frame = actor.vy < -120 ? 0 : actor.vy > 120 ? 2 : 1;
      } else if (Math.abs(actor.vx) > 20) {
        sheet = SHEET.chickenRun;
        frame = Math.floor(Date.now() / 90);
      }
      const drew =
        this.drawSheet(sheet, frame, color, cx, cy, s, facing) ||
        this.drawSheet(SHEET.chickenIdle, 0, color, cx, cy, s, facing);
      if (drew) {
        if (actor.finished) {
          this.ctx.strokeStyle = "#ffffff";
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      } else {
        this.ctx.fillStyle = color;
        circle(this.ctx, cx, cy, PLAYER_W / 2 + 2);
        this.ctx.strokeStyle = actor.finished ? "#ffffff" : "#00000033";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, PLAYER_W / 2 + 2, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Nameplate above the player so it's obvious who's who in a 4-player
      // dogpile. Drawn in world space so the camera zoom scales it.
      const name = player?.displayName ?? `P${actor.slot + 1}`;
      this.ctx.font = "600 11px system-ui, sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "bottom";
      this.ctx.fillStyle = "rgba(0,0,0,0.6)";
      this.ctx.fillText(name, actor.x + PLAYER_W / 2 + 1, actor.y - 4 + 1);
      this.ctx.fillStyle = color;
      this.ctx.fillText(name, actor.x + PLAYER_W / 2, actor.y - 4);
      this.ctx.textAlign = "start";
      this.ctx.textBaseline = "alphabetic";
    }
  }

  private drawCursors(state: GameState): void {
    if (state.phase !== "placement") return;
    for (const cursor of state.cursors) {
      if (cursor.confirmed) continue;
      const player = state.players.find((p) => p.slot === cursor.slot);
      const color = player?.color ?? "#ffffff";

      const probe = probePlacement(state, cursor);
      this.ctx.save();
      this.ctx.globalAlpha = 0.95;
      this.ctx.strokeStyle = probe.ok ? color : "#ef4444";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(cursor.x, cursor.y, 16, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      // Cursor reticle on top so the player can find their cursor easily.
      if (ready(IMG.cursor)) {
        const cs = 28;
        this.ctx.drawImage(tinted(IMG.cursor, color), cursor.x - cs / 2, cursor.y - cs / 2, cs, cs);
      } else {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(cursor.x, cursor.y, 8, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }
  }

  private drawFloats(state: GameState): void {
    if (!state.floats.length) return;
    this.ctx.font = "700 16px system-ui, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "bottom";
    for (const f of state.floats) {
      const alpha = Math.max(0, f.life / f.maxLife);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = "rgba(0,0,0,0.7)";
      this.ctx.fillText(f.text, f.x + 1, f.y + 1);
      this.ctx.fillStyle = f.color;
      this.ctx.fillText(f.text, f.x, f.y);
    }
    this.ctx.globalAlpha = 1;
    this.ctx.textAlign = "start";
    this.ctx.textBaseline = "alphabetic";
  }

  private drawParticles(state: GameState): void {
    if (!state.particles.length) return;
    for (const p of state.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    this.ctx.globalAlpha = 1;
  }

  private drawArenaDynamics(state: GameState): void {
    const dyns = state.arena.dynamics;
    if (!dyns?.length) return;
    const elapsed = raceElapsedMs(state);
    for (const d of dyns) {
      if (d.kind === "blade") {
        const tip = bladeTip(d, elapsed);
        // Arm
        this.ctx.strokeStyle = "#7f1d1d";
        this.ctx.lineWidth = d.thickness;
        this.ctx.lineCap = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(d.pivotX, d.pivotY);
        this.ctx.lineTo(tip.x, tip.y);
        this.ctx.stroke();
        // Pivot bolt
        this.ctx.fillStyle = "#1f2937";
        this.ctx.beginPath();
        this.ctx.arc(d.pivotX, d.pivotY, d.thickness, 0, Math.PI * 2);
        this.ctx.fill();
        // Tip marker
        this.ctx.fillStyle = "#ef4444";
        this.ctx.beginPath();
        this.ctx.arc(tip.x, tip.y, d.thickness * 0.7, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (d.kind === "sweeper") {
        // Faint guide rail so players can read the path before the sweeper
        // arrives — UCH-style telegraphing.
        this.ctx.strokeStyle = "rgba(127,29,29,0.35)";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([6, 6]);
        this.ctx.beginPath();
        this.ctx.moveTo(d.x1, d.y1);
        this.ctx.lineTo(d.x2, d.y2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        const c = sweeperCenter(d, elapsed);
        this.ctx.fillStyle = "#7f1d1d";
        this.ctx.fillRect(c.x - d.w / 2, c.y - d.h / 2, d.w, d.h);
        this.ctx.strokeStyle = "#ef4444";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(c.x - d.w / 2, c.y - d.h / 2, d.w, d.h);
      }
    }
    this.ctx.lineCap = "butt";
  }

  private drawGoalPulses(state: GameState): void {
    if (!state.goalPulses.length) return;
    const g = state.arena.goal;
    const cx = g.x + g.w / 2;
    const cy = g.y + g.h / 2;
    for (const pulse of state.goalPulses) {
      const t = 1 - pulse.life / pulse.maxLife;
      const radius = 24 + t * 96;
      this.ctx.globalAlpha = Math.max(0, 1 - t);
      this.ctx.strokeStyle = pulse.color;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.globalAlpha = 1;
  }
}

function colorForPiece(id: string): string {
  if (id === "coin") return "#f5d24a";
  if (id === "diamond") return "#67e8f9";
  if (id === "spike" || id === "saw" || id === "crusher" || id === "coals" || id === "puck")
    return "#7f1d1d";
  if (id === "mace" || id === "log") return "#7f1d1d";
  if (id === "fan") return "#94a3b8";
  if (id === "ice") return "#bae6fd";
  if (id === "honey") return "#f59e0b";
  if (id === "crumble") return "#78716c";
  if (id === "bouncy" || id === "trampoline") return "#fbbf24";
  if (id === "conveyor") return "#9ca3af";
  if (id === "ladder") return "#a16207";
  if (id === "lowGravity") return "#8b5cf6";
  if (id === "slipperyWorld") return "#38bdf8";
  if (id === "pendulum" || id === "plank" || id === "block" || id === "stairs") return "#a8a29e";
  return "#cbd5e1";
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
