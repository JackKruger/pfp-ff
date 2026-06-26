import { LOGICAL_H, LOGICAL_W, PLAYER_H, PLAYER_W } from "../constants.js";
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
    this.drawActors(state);
    this.drawCursors(state);

    this.ctx.restore();

    drawHud(this.ctx, state, cw, ch);
  }

  private drawArena(state: GameState): void {
    const { arena } = state;

    // Arena bounds outline (helps the eye locate edges in programmer-art).
    this.ctx.strokeStyle = "#1a2030";
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(arena.bounds.x, arena.bounds.y, arena.bounds.w, arena.bounds.h);

    // Solids
    this.ctx.fillStyle = "#2a3b56";
    for (const s of arena.solids) this.ctx.fillRect(s.x, s.y, s.w, s.h);

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
    for (const p of state.pieces) {
      const def = PIECES[p.pieceId];
      const aabb = pieceAabb(p);
      this.ctx.fillStyle = colorForPiece(p.pieceId);
      this.ctx.fillRect(aabb.x, aabb.y, aabb.w, aabb.h);
      if (def.lethal) {
        this.ctx.strokeStyle = "#ef4444";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(aabb.x, aabb.y, aabb.w, aabb.h);
      }
    }
  }

  private drawActors(state: GameState): void {
    for (const actor of state.actors) {
      const player = state.players.find((p) => p.slot === actor.slot);
      const color = player?.color ?? "#cccccc";

      if (!actor.alive && actor.deathPos) {
        // Skull glyph (placeholder: filled circle with X).
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.6;
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
    }
  }

  private drawCursors(state: GameState): void {
    if (state.phase !== "placement") return;
    for (const cursor of state.cursors) {
      const player = state.players.find((p) => p.slot === cursor.slot);
      const color = player?.color ?? "#ffffff";
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(cursor.x, cursor.y, 8, 0, Math.PI * 2);
      this.ctx.stroke();
    }
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
