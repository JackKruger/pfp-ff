import { PIECES } from "../pieces/registry.js";
import { pieceForCursor } from "../phases/placement.js";
import { raceIsCountdown } from "../phases/race.js";
import type { GameState } from "../types.js";

/** Top-overlay HUD: player chips, phase banner, timer. */
export function drawHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  _ch: number,
): void {
  // Player chips along the top
  const chipW = Math.min(220, (cw - 64) / Math.max(1, state.players.length));
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    const x = 16 + i * (chipW + 8);
    const y = 16;
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.fillRect(x, y, chipW, 56);
    ctx.fillStyle = p.color;
    ctx.fillRect(x, y, 6, 56);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(p.displayName ?? `P${p.slot + 1}`, x + 16, y + 8);
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.fillText(`${p.score.finalScore}`, x + 16, y + 28);
    ctx.font = "500 12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`🪙 ${p.score.coinsCollected}`, x + 80, y + 32);
  }

  // Phase banner + timer
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#e2e8f0";
  const banner = bannerText(state);
  const w = ctx.measureText(banner).width;
  ctx.fillText(banner, (cw - w) / 2, 88);

  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillStyle = "#cbd5e1";
  const secs = Math.ceil(state.phaseTimer / 1000);
  const subBanner = subText(state, secs);
  const sw = ctx.measureText(subBanner).width;
  ctx.fillText(subBanner, (cw - sw) / 2, 124);

  // Placement: show each player's currently-selected piece in their chip.
  if (state.phase === "placement") {
    for (const c of state.cursors) {
      const i = state.players.findIndex((pp) => pp.slot === c.slot);
      if (i < 0) continue;
      const x = 16 + i * (chipW + 8);
      const y = 16;
      const piece = PIECES[pieceForCursor(c)];
      ctx.font = "500 12px system-ui, sans-serif";
      ctx.fillStyle = c.confirmed ? "#22c55e" : "#f59e0b";
      ctx.fillText(c.confirmed ? "READY" : piece.name, x + 100, y + 8);
    }
  }
}

function bannerText(state: GameState): string {
  switch (state.phase) {
    case "intro":
      return "Get ready…";
    case "placement":
      return `Round ${state.round} — Place a trap`;
    case "race":
      return raceIsCountdown(state) ? "GO IN…" : "RACE!";
    case "score":
      return "Round results";
    case "final":
      return "Match over";
  }
}

function subText(state: GameState, secs: number): string {
  if (state.phase === "placement") return `${secs}s to commit`;
  if (state.phase === "race")
    return raceIsCountdown(state) ? "Steady…" : `${secs}s left`;
  if (state.phase === "score") return "next round…";
  return "";
}
