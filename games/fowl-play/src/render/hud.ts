import {
  FINAL_HOLD_MS,
  PLACEMENT_MS,
  RACE_MAX_MS,
  SCORE_MS,
  URGENCY_THRESHOLD_MS,
} from "../constants.js";
import { computeAwards } from "../awards.js";
import { countdownRemainingMs, raceElapsedMs, raceIsCountdown } from "../phases/race.js";
import { computeStandings } from "../phases/score.js";
import type { GameState, RoundOutcome } from "../types.js";
import { IMG, ready, tinted } from "./assets.js";

/** Top-overlay HUD: player chips, phase banner, timer, overlays. */
export function drawHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  ch: number,
): void {
  drawPlayerChips(ctx, state, cw);
  drawBanner(ctx, state, cw);
  drawModifierBadges(ctx, state, cw);
  drawPhaseBanner(ctx, state, cw, ch);

  if (state.phase === "race" && raceIsCountdown(state)) drawCountdown(ctx, state, cw, ch);
  if (state.phase === "score") drawScoreOverlay(ctx, state, cw, ch);
  if (state.phase === "final") drawFinalOverlay(ctx, state, cw, ch);
  if (state.phase === "intro" && state.showLookAroundHint) drawLookAroundHint(ctx, cw, ch);
  drawToasts(ctx, state, cw, ch);
  drawUrgencyVignette(ctx, state, cw, ch);
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

function drawUrgencyVignette(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  ch: number,
): void {
  const active =
    (state.phase === "placement" || (state.phase === "race" && !raceIsCountdown(state))) &&
    state.phaseTimer > 0 &&
    state.phaseTimer <= URGENCY_THRESHOLD_MS;
  if (!active) return;
  const pulse = 0.45 + 0.25 * Math.sin(Date.now() / 100);
  const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.25, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
  g.addColorStop(0, "rgba(239,68,68,0)");
  g.addColorStop(1, `rgba(239,68,68,${pulse})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);
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
    const chipH = 56;
    if (ready(IMG.chipBg)) {
      // Tinted chip art + a dark inner band so text stays legible on any slot color.
      ctx.drawImage(tinted(IMG.chipBg, p.color), x, y, chipW, chipH);
      ctx.fillStyle = "rgba(15,23,42,0.55)";
      ctx.fillRect(x + 10, y + 6, chipW - 16, chipH - 12);
    } else {
      ctx.fillStyle = "rgba(15,23,42,0.85)";
      ctx.fillRect(x, y, chipW, chipH);
      ctx.fillStyle = p.color;
      ctx.fillRect(x, y, 6, chipH);
    }
    const portraitX = x + 28;
    const textX = ready(IMG.chicken) ? x + 52 : x + 16;
    if (ready(IMG.chicken)) {
      ctx.drawImage(tinted(IMG.chicken, p.color), portraitX - 15, y + 13, 30, 30);
    }
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(p.displayName ?? `P${p.slot + 1}`, textX, y + 8, chipW - (textX - x) - 12);
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.fillText(`${p.score.finalScore}`, textX, y + 28);
    ctx.font = "500 12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`🪙 ${p.score.coinsCollected}`, textX + 64, y + 32);

    if (state.phase === "placement") {
      const cursor = state.cursors.find((c) => c.slot === p.slot);
      if (cursor) {
        ctx.font = "500 12px system-ui, sans-serif";
        ctx.fillStyle = cursor.confirmed ? "#22c55e" : "#f59e0b";
        const label = cursor.confirmed ? "READY" : "CHOOSING";
        // Clamp to the chip so long piece names don't spill past its edge.
        ctx.fillText(label, x + chipW - 94, y + 8, 82);
      }
    }
  }
}

function drawModifierBadges(ctx: CanvasRenderingContext2D, state: GameState, cw: number): void {
  const modifiers = [...new Set(state.pieces
    .filter((p) => p.pieceId === "lowGravity" || p.pieceId === "slipperyWorld")
    .map((p) => p.pieceId))];
  if (!modifiers.length) return;

  const badgeH = 26;
  let x = cw - 16;
  const y = 82;
  ctx.textBaseline = "middle";
  ctx.font = "700 12px system-ui, sans-serif";
  for (let i = modifiers.length - 1; i >= 0; i--) {
    const id = modifiers[i];
    const label = id === "lowGravity" ? "LOW GRAV" : "SLIPPERY";
    const w = Math.ceil(ctx.measureText(label).width) + 28;
    x -= w;
    ctx.fillStyle = id === "lowGravity" ? "rgba(124,58,237,0.85)" : "rgba(14,116,144,0.85)";
    ctx.fillRect(x, y, w, badgeH);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(label, x + 14, y + badgeH / 2);
    x -= 8;
  }
  ctx.textBaseline = "alphabetic";
}

/* -------------------------------------------------------------------------- */
/*  Phase banner art                                                          */
/* -------------------------------------------------------------------------- */

const PHASE_BANNER_MS = 1300;

/**
 * Transient phase-start banner image (placement / GO / round-results), shown for
 * ~1.3s with a quick fade in/out. Falls back to nothing (the text banner from
 * drawBanner always renders) if the art isn't present.
 */
function drawPhaseBanner(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  ch: number,
): void {
  let img: HTMLImageElement | null = null;
  let elapsed = -1;
  if (state.phase === "placement") {
    img = IMG.bannerPlacement;
    elapsed = PLACEMENT_MS - state.phaseTimer;
  } else if (state.phase === "race" && !raceIsCountdown(state)) {
    img = IMG.bannerRace;
    elapsed = raceElapsedMs(state);
  } else if (state.phase === "score") {
    img = IMG.bannerScore;
    elapsed = SCORE_MS - state.phaseTimer;
  }
  if (!ready(img) || elapsed < 0 || elapsed > PHASE_BANNER_MS) return;

  const alpha =
    elapsed < 200
      ? elapsed / 200
      : elapsed > PHASE_BANNER_MS - 400
        ? (PHASE_BANNER_MS - elapsed) / 400
        : 1;
  const bw = Math.min(cw * 0.5, 520);
  const bh = bw * (img.naturalHeight / img.naturalWidth);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(img, cw / 2 - bw / 2, ch * 0.2, bw, bh);
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/*  Phase banner (text) + timer clock                                         */
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

  if (subBanner) drawTimerClock(ctx, state, (cw - sw) / 2 - 30, 122, urgent);
}

/** Small clock face with a sweeping hand, drawn left of the sub-banner timer. */
function drawTimerClock(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  y: number,
  urgent: boolean,
): void {
  if (!ready(IMG.hudClock)) return;
  let frac = -1; // fraction of time remaining, 1 → 0
  if (state.phase === "placement") frac = state.phaseTimer / PLACEMENT_MS;
  else if (state.phase === "race" && !raceIsCountdown(state))
    frac = 1 - raceElapsedMs(state) / RACE_MAX_MS;
  if (frac < 0) return;
  frac = Math.max(0, Math.min(1, frac));

  const s = 22;
  const cx = x;
  const cy = y;
  ctx.drawImage(IMG.hudClock, cx - s / 2, cy - s / 2, s, s);
  // Hand: points up at full time, sweeps clockwise as it runs out.
  const angle = -Math.PI / 2 + (1 - frac) * Math.PI * 2;
  ctx.save();
  ctx.strokeStyle = urgent ? "#ef4444" : "#0f172a";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * s * 0.34, cy + Math.sin(angle) * s * 0.34);
  ctx.stroke();
  ctx.restore();
}

function bannerText(state: GameState): string {
  switch (state.phase) {
    case "levelSelect":
      return "Choose your arena";
    case "intro":
      if (state.suddenDeath) return "SUDDEN DEATH";
      if (state.round > 1) return `Round ${state.round} — Look around`;
      return "Get ready…";
    case "placement":
      return `Round ${state.round} — Place a trap`;
    case "race":
      if (state.suddenDeath) return raceIsCountdown(state) ? "Tiebreak!" : "SUDDEN DEATH";
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
  const awards = computeAwards(state.players);

  const awardsH = awards.length ? 40 + awards.length * 30 : 0;
  const panelW = 560;
  const panelH = 140 + standings.length * 44 + awardsH + 24;
  const px = (cw - panelW) / 2;
  const py = (ch - panelH) / 2;

  // Semi-transparent backdrop so the world-space confetti the FSM emits each
  // tick remains visible behind the standings panel.
  ctx.fillStyle = "rgba(2,6,23,0.55)";
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = "rgba(15,23,42,0.95)";
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = winner?.color ?? "#f59e0b";
  ctx.lineWidth = 3;
  ctx.strokeRect(px, py, panelW, panelH);

  // Winner title with a gentle hop so it feels alive.
  const hop = Math.sin(Date.now() / 220) * 4;
  ctx.font = "800 34px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.fillStyle = winner?.color ?? "#e2e8f0";
  ctx.fillText(winner ? `${winner.displayName} wins!` : "Match over", cw / 2, py + 24 + hop);

  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Final standings", cw / 2, py + 76);
  ctx.textAlign = "start";

  let row = py + 108;
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

  // Awards — one line each: "Menace   Alice · 3 trap kills".
  if (awards.length) {
    row += 8;
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 24, row);
    ctx.lineTo(px + panelW - 24, row);
    ctx.stroke();
    row += 12;
    for (const award of awards) {
      const player = state.players.find((p) => p.slot === award.slot);
      if (!player) continue;
      ctx.font = "700 15px system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`🏆 ${award.title}`, px + 44, row + 6);
      ctx.font = "500 14px system-ui, sans-serif";
      ctx.fillStyle = player.color;
      ctx.fillText(player.displayName ?? `P${player.slot + 1}`, px + 280, row + 7);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`· ${award.detail}`, px + 400, row + 7);
      row += 30;
    }
  }

  // "Press A to continue" once we're past the grace window. Pulses so it reads
  // as an interactive prompt rather than a static label.
  if (state.phaseTimer <= FINAL_HOLD_MS - 1500) {
    const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 250);
    ctx.globalAlpha = pulse;
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Press A to continue", cw / 2, py + panelH - 28);
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
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
