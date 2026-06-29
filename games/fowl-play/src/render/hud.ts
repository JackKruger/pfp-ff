import { URGENCY_THRESHOLD_MS } from "../constants.js";
import { PIECES } from "../pieces/registry.js";
import { pieceForCursor } from "../phases/placement.js";
import { countdownRemainingMs, raceIsCountdown } from "../phases/race.js";
import { computeStandings } from "../phases/score.js";
import type { GameState, RoundOutcome } from "../types.js";

/** Top-overlay HUD: player chips, phase banner, timer, overlays. */
export function drawHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  ch: number,
): void {
  drawPlayerChips(ctx, state, cw);
  drawBanner(ctx, state, cw);

  if (state.phase === "race" && raceIsCountdown(state)) drawCountdown(ctx, state, cw, ch);
  if (state.phase === "score") drawScoreOverlay(ctx, state, cw, ch);
  if (state.phase === "final") drawFinalOverlay(ctx, state, cw, ch);
  if (state.phase === "intro" && state.showLookAroundHint) drawLookAroundHint(ctx, cw, ch);
  drawToasts(ctx, state, cw, ch);
  if (state.paused) drawPauseOverlay(ctx, cw, ch);
}

function drawToasts(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  ch: number,
): void {
  if (!state.toasts.length) return;
  const w = Math.min(560, cw - 32);
  const lineH = 30;
  // Stack newest at bottom; older fades upward.
  const baseY = ch - 96;
  // Single fade over the last 600 ms of each toast's lifetime.
  const FADE_MS = 600;
  for (let i = 0; i < state.toasts.length; i++) {
    const t = state.toasts[i];
    ctx.globalAlpha = Math.max(0, Math.min(1, t.life / FADE_MS));
    const y = baseY - (state.toasts.length - 1 - i) * (lineH + 4);
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.fillRect((cw - w) / 2, y, w, lineH);
    ctx.fillStyle = t.color;
    ctx.fillRect((cw - w) / 2, y, 4, lineH);
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(t.text, (cw - w) / 2 + 16, y + lineH / 2);
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = "alphabetic";
}

/* -------------------------------------------------------------------------- */
/*  Top chips                                                                 */
/* -------------------------------------------------------------------------- */

function drawPlayerChips(ctx: CanvasRenderingContext2D, state: GameState, cw: number): void {
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

    if (state.phase === "placement") {
      const cursor = state.cursors.find((c) => c.slot === p.slot);
      if (cursor) {
        const piece = PIECES[pieceForCursor(cursor)];
        ctx.font = "500 12px system-ui, sans-serif";
        ctx.fillStyle = cursor.confirmed ? "#22c55e" : "#f59e0b";
        ctx.fillText(cursor.confirmed ? "READY" : piece.name, x + 100, y + 8);
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Phase banner                                                              */
/* -------------------------------------------------------------------------- */

function drawBanner(ctx: CanvasRenderingContext2D, state: GameState, cw: number): void {
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#e2e8f0";
  const banner = bannerText(state);
  const w = ctx.measureText(banner).width;
  ctx.fillText(banner, (cw - w) / 2, 88);

  // Sub-banner: timer with red urgency under URGENCY_THRESHOLD_MS during the
  // placement and race phases.
  const urgent =
    (state.phase === "placement" || (state.phase === "race" && !raceIsCountdown(state))) &&
    state.phaseTimer > 0 &&
    state.phaseTimer <= URGENCY_THRESHOLD_MS;
  ctx.font = urgent ? "700 18px system-ui, sans-serif" : "500 16px system-ui, sans-serif";
  ctx.fillStyle = urgent ? "#ef4444" : "#cbd5e1";
  const secs = Math.ceil(state.phaseTimer / 1000);
  const subBanner = subText(state, secs);
  const sw = ctx.measureText(subBanner).width;
  ctx.fillText(subBanner, (cw - sw) / 2, 124);
}

function bannerText(state: GameState): string {
  switch (state.phase) {
    case "levelSelect":
      return "Choose your arena";
    case "intro":
      return "Get ready…";
    case "placement":
      return `Round ${state.round} — Place a trap`;
    case "race":
      return raceIsCountdown(state) ? "Get set…" : "RACE!";
    case "score":
      return "Round results";
    case "final":
      return "Match over";
  }
}

function subText(state: GameState, secs: number): string {
  if (state.phase === "placement") return `${secs}s to commit`;
  if (state.phase === "race") return raceIsCountdown(state) ? "" : `${secs}s left`;
  return "";
}

/* -------------------------------------------------------------------------- */
/*  Countdown overlay                                                         */
/* -------------------------------------------------------------------------- */

function drawCountdown(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  ch: number,
): void {
  const remaining = countdownRemainingMs(state);
  let label: string;
  if (remaining > 2000) label = "3";
  else if (remaining > 1000) label = "2";
  else if (remaining > 0) label = "1";
  else label = "GO!";

  ctx.font = "900 180px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillText(label, cw / 2 + 4, ch / 2 + 4);
  ctx.fillStyle = label === "GO!" ? "#22c55e" : "#fbbf24";
  ctx.fillText(label, cw / 2, ch / 2);
  ctx.textAlign = "start";
}

/* -------------------------------------------------------------------------- */
/*  Score overlay                                                             */
/* -------------------------------------------------------------------------- */

function drawScoreOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  ch: number,
): void {
  const log = state.lastRound;
  if (!log) return;

  const panelW = 480;
  const panelH = 60 + state.players.length * 40;
  const px = (cw - panelW) / 2;
  const py = (ch - panelH) / 2;

  ctx.fillStyle = "rgba(15,23,42,0.92)";
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, panelW, panelH);

  ctx.font = "700 22px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(outcomeLabel(log.outcome), px + 20, py + 16);

  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Δ this round → total", px + panelW - 160, py + 22);

  const sorted = [...state.players].sort(
    (a, b) => (log.delta.get(b.slot) ?? 0) - (log.delta.get(a.slot) ?? 0),
  );

  let row = py + 56;
  for (const p of sorted) {
    const d = log.delta.get(p.slot) ?? 0;
    ctx.fillStyle = p.color;
    ctx.fillRect(px + 20, row + 6, 6, 24);
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(p.displayName ?? `P${p.slot + 1}`, px + 36, row + 8);

    ctx.font = "600 18px system-ui, sans-serif";
    ctx.fillStyle = d > 0 ? "#22c55e" : d < 0 ? "#ef4444" : "#94a3b8";
    const dLabel = d > 0 ? `+${d}` : `${d}`;
    ctx.textAlign = "end";
    ctx.fillText(dLabel, px + panelW - 110, row + 8);

    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`${p.score.finalScore}`, px + panelW - 24, row + 8);
    ctx.textAlign = "start";
    row += 40;
  }
}

function outcomeLabel(outcome: RoundOutcome): string {
  switch (outcome) {
    case "all_finished":
      return "All finished";
    case "all_dead":
      return "No survivors";
    case "timeout":
      return "Time's up";
  }
}

/* -------------------------------------------------------------------------- */
/*  Final overlay                                                             */
/* -------------------------------------------------------------------------- */

function drawFinalOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  ch: number,
): void {
  const standings = computeStandings(state);
  const winnerSlot = standings.find((s) => s.rank === 1)?.slot;
  const winner = winnerSlot != null ? state.players.find((p) => p.slot === winnerSlot) : null;

  const panelW = 560;
  const panelH = 120 + standings.length * 44;
  const px = (cw - panelW) / 2;
  const py = (ch - panelH) / 2;

  ctx.fillStyle = "rgba(2,6,23,0.95)";
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = "rgba(15,23,42,0.95)";
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = winner?.color ?? "#f59e0b";
  ctx.lineWidth = 3;
  ctx.strokeRect(px, py, panelW, panelH);

  ctx.font = "800 32px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.fillStyle = winner?.color ?? "#e2e8f0";
  ctx.fillText(winner ? `${winner.displayName} wins!` : "Match over", cw / 2, py + 24);

  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Final standings", cw / 2, py + 68);
  ctx.textAlign = "start";

  let row = py + 100;
  for (const s of standings) {
    const player = state.players.find((p) => p.slot === s.slot);
    if (!player) continue;
    ctx.fillStyle = player.color;
    ctx.fillRect(px + 24, row + 8, 6, 24);
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`#${s.rank}`, px + 44, row + 10);
    ctx.fillText(player.displayName ?? `P${player.slot + 1}`, px + 96, row + 10);

    ctx.font = "500 14px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      `${player.score.finalScore} pts · ${player.score.coinsCollected}🪙 · ${player.score.finishes} finishes`,
      px + 280,
      row + 12,
    );
    row += 44;
  }
}

/* -------------------------------------------------------------------------- */
/*  Intro / look-around hint                                                  */
/* -------------------------------------------------------------------------- */

function drawLookAroundHint(ctx: CanvasRenderingContext2D, cw: number, ch: number): void {
  const lines = [
    "L-stick / D-pad — move cursor / your chicken",
    "A — confirm placement / jump",
    "B — cancel last placement",
    "X / Y — cycle piece in hand",
    "LB / RB — rotate piece",
    "Start — ready up early",
  ];
  const panelW = 460;
  const panelH = 40 + lines.length * 22;
  const px = (cw - panelW) / 2;
  const py = ch - panelH - 64;

  ctx.fillStyle = "rgba(15,23,42,0.9)";
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, panelW, panelH);

  ctx.font = "600 14px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText("Controls", px + 16, py + 12);

  ctx.font = "500 13px system-ui, sans-serif";
  ctx.fillStyle = "#cbd5e1";
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], px + 16, py + 36 + i * 22);
}

function drawPauseOverlay(ctx: CanvasRenderingContext2D, cw: number, ch: number): void {
  ctx.fillStyle = "rgba(2,6,23,0.7)";
  ctx.fillRect(0, 0, cw, ch);
  ctx.font = "900 96px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText("PAUSED", cw / 2 + 3, ch / 2 + 3);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText("PAUSED", cw / 2, ch / 2);
  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Press Start to resume", cw / 2, ch / 2 + 64);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

