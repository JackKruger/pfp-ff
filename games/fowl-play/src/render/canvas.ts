import { LOGICAL_H, LOGICAL_W, PLAYER_H, PLAYER_W } from "../constants.js";
import { ghostFor, probePlacement } from "../phases/placement.js";
import { bladeTip, raceElapsedMs } from "../phases/race.js";
import { pieceAabb, PIECES } from "../pieces/registry.js";
import type { GameState, Player } from "../types.js";
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

    // Camera transform (logical 1280x720 maps to canvas)
    this.camera = lerpCamera(this.camera, targetFor(state));

    this.ctx.save();
    const scaleX = cw / LOGICAL_W;
    const scaleY = ch / LOGICAL_H;
    const fit = Math.min(scaleX, scaleY);
    this.ctx.translate(cw / 2, ch / 2);
    this.ctx.scale(fit * this.camera.zoom, fit * this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);

    this.drawArena(state);
    this.drawPieces(state);
    this.drawArenaDynamics(state);
    this.drawGoalPulses(state);
    this.drawParticles(state);
    this.drawActors(state);
    this.drawCursors(state);
    this.drawFloats(state);

    this.ctx.restore();

    drawHud(this.ctx, state, cw, ch);
  }

  private drawArena(state: GameState): void {
    const { arena } = state;

    // Background gradient from the arena's palette hint, if any.
    if (arena.bg) {
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
      const def = PIECES[p.pieceId];
      const aabb = pieceAabb(p);

      // Scorer shimmer — soft alpha pulse so coins read as alive.
      if (p.pieceId === "coin" || p.pieceId === "diamond") {
        const phase = (now / 250 + p.uid * 0.7) % (Math.PI * 2);
        const pulse = 0.65 + 0.35 * Math.sin(phase);
        this.ctx.globalAlpha = pulse;
        this.ctx.fillStyle = colorForPiece(p.pieceId);
        this.ctx.beginPath();
        const r = aabb.w / 2;
        this.ctx.arc(aabb.x + r, aabb.y + r, r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
        continue;
      }

      // Saw — render as a rotating gear-disc for legibility.
      if (p.pieceId === "saw") {
        const angle = (elapsed / 600 + p.uid * 0.3) * Math.PI * 2;
        this.drawSaw(aabb, angle);
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
        // Skull glyph (placeholder: filled circle with X).
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.4;
        circle(this.ctx, actor.deathPos.x + PLAYER_W / 2, actor.deathPos.y + PLAYER_H / 2, 12);
        this.ctx.globalAlpha = 1;
        continue;
      }
      if (!actor.alive) continue;

      // Live player: filled circle with outline.
      this.ctx.fillStyle = color;
      circle(this.ctx, actor.x + PLAYER_W / 2, actor.y + PLAYER_H / 2, PLAYER_W / 2 + 2);
      this.ctx.strokeStyle = actor.finished ? "#ffffff" : "#00000033";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(
        actor.x + PLAYER_W / 2,
        actor.y + PLAYER_H / 2,
        PLAYER_W / 2 + 2,
        0,
        Math.PI * 2,
      );
      this.ctx.stroke();

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

      // Ghost piece preview at the snapped position, tinted by validity.
      const ghost = ghostFor(cursor);
      const probe = probePlacement(state, cursor);
      const ghostAabb = pieceAabb(ghost);
      this.ctx.save();
      this.ctx.globalAlpha = 0.45;
      this.ctx.fillStyle = probe.ok ? color : "#ef4444";
      this.ctx.fillRect(ghostAabb.x, ghostAabb.y, ghostAabb.w, ghostAabb.h);
      this.ctx.globalAlpha = 0.95;
      this.ctx.strokeStyle = probe.ok ? color : "#ef4444";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(ghostAabb.x, ghostAabb.y, ghostAabb.w, ghostAabb.h);
      this.ctx.restore();

      // Cursor reticle on top so the player can find their cursor easily.
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(cursor.x, cursor.y, 8, 0, Math.PI * 2);
      this.ctx.stroke();
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
      if (d.kind !== "blade") continue;
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
  if (id === "bouncy" || id === "trampoline") return "#fbbf24";
  if (id === "conveyor") return "#9ca3af";
  if (id === "ladder") return "#a16207";
  if (id === "pendulum" || id === "plank" || id === "block") return "#a8a29e";
  return "#cbd5e1";
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Unused helpers to silence "unused" warnings on partial implementations.
export const _logicalSize = { w: LOGICAL_W, h: LOGICAL_H };
export const _playerSize = { w: PLAYER_W, h: PLAYER_H };
export type _Player = Player;
