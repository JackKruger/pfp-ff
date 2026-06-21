import { TOTAL_ROUNDS, type GameState, type Player } from "./game.js";
import type { Tile, TileKind } from "./board.js";

const TILE_FILL: Record<TileKind, string> = {
  start: "#22c55e",
  blue: "#3b82f6",
  red: "#ef4444",
  star: "#f59e0b",
  event: "#a855f7",
};

const TILE_GLYPH: Record<TileKind, string> = {
  start: "★",
  blue: "+3",
  red: "−3",
  star: "☆",
  event: "?",
};

export function render(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0a0b14";
  ctx.fillRect(0, 0, w, h);

  // The minigame owns the whole screen while it's running.
  if (state.phase === "minigame" && state.minigame) {
    state.minigame.render(ctx, w, h);
    return;
  }

  const hudH = Math.min(120, h * 0.16);
  drawHud(ctx, state, w, hudH);
  drawBoard(ctx, state, 0, hudH, w, h - hudH);

  switch (state.phase) {
    case "intro":
      drawCenterCard(ctx, w, h, "PARTY MIX", "Press A to start the party");
      break;
    case "turn":
      drawTurnPrompt(ctx, state, w, h);
      break;
    case "rolling":
      drawDie(ctx, state, w, h);
      break;
    case "resolve":
      if (state.banner) drawBanner(ctx, state.banner, w, h);
      break;
    case "mgIntro":
      drawCenterCard(ctx, w, h, `Minigame: ${state.mgName}`, state.mgRules);
      break;
    case "mgResult":
      drawPayout(ctx, state, w, h);
      break;
    case "roundEnd":
      drawCenterCard(
        ctx,
        w,
        h,
        `Round ${state.round} complete`,
        "Press A for the next round",
      );
      break;
    case "results":
      drawResults(ctx, state, w, h);
      break;
  }
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState, w: number, hudH: number): void {
  const n = state.players.length;
  const cardW = w / n;
  state.players.forEach((p, i) => {
    const x = i * cardW;
    const active = i === state.activeIdx && state.phase !== "intro" && state.phase !== "results";
    ctx.fillStyle = active ? "#161a2b" : "#10131f";
    ctx.fillRect(x + 4, 4, cardW - 8, hudH - 8);
    if (active) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 4, 4, cardW - 8, hudH - 8);
    }

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x + 24, hudH / 2, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillText(p.name, x + 44, hudH / 2 - 16);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`☆ ${p.stars}`, x + 44, hudH / 2 + 6);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`◉ ${p.coins}`, x + 44, hudH / 2 + 26);
  });

  ctx.fillStyle = "#9ca3af";
  ctx.textAlign = "center";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillText(`ROUND ${state.round} / ${TOTAL_ROUNDS}`, w / 2, hudH - 14);
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ox: number,
  oy: number,
  w: number,
  h: number,
): void {
  const { board } = state;
  const pad = 40;
  const cell = Math.min((w - pad * 2) / board.cols, (h - pad * 2) / board.rows);
  const boardW = cell * board.cols;
  const boardH = cell * board.rows;
  const startX = ox + (w - boardW) / 2 + cell / 2;
  const startY = oy + (h - boardH) / 2 + cell / 2;

  const center = (t: Tile) => ({ x: startX + t.col * cell, y: startY + t.row * cell });

  // Connecting path under the tiles.
  ctx.strokeStyle = "#1f2433";
  ctx.lineWidth = Math.max(6, cell * 0.5);
  ctx.lineJoin = "round";
  ctx.beginPath();
  board.tiles.forEach((t, i) => {
    const c = center(t);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.closePath();
  ctx.stroke();

  const r = cell * 0.38;
  for (const t of board.tiles) {
    const c = center(t);
    // Star spots are dim unless they currently hold the buyable star.
    const isActiveStar = t.kind === "star" && t.index === state.starTile;
    const dimStar = t.kind === "star" && !isActiveStar;
    ctx.globalAlpha = dimStar ? 0.35 : 1;
    ctx.fillStyle = TILE_FILL[t.kind];
    ctx.beginPath();
    ctx.arc(c.x, c.y, isActiveStar ? r * 1.12 : r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = `bold ${Math.floor(cell * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isActiveStar ? "★" : TILE_GLYPH[t.kind], c.x, c.y);
  }

  // Pawns, fanned out when multiple players share a tile.
  const byTile = new Map<number, Player[]>();
  for (const p of state.players) {
    const arr = byTile.get(p.tile) ?? [];
    arr.push(p);
    byTile.set(p.tile, arr);
  }
  for (const [tileIdx, group] of byTile) {
    const t = board.tiles[tileIdx]!;
    const c = center(t);
    group.forEach((p, i) => {
      const angle = (i / group.length) * Math.PI * 2;
      const off = group.length > 1 ? r * 0.5 : 0;
      const px = c.x + Math.cos(angle) * off;
      const py = c.y + Math.sin(angle) * off;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, cell * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0a0b14";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }
}

function drawTurnPrompt(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
): void {
  const p = state.players[state.activeIdx]!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = p.color;
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.fillText(`${p.name}'s turn`, w / 2, h - 70);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "20px system-ui, sans-serif";
  ctx.fillText("Press A to roll", w / 2, h - 38);
}

function drawDie(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number): void {
  const size = Math.min(w, h) * 0.18;
  const x = (w - size) / 2;
  const y = (h - size) / 2;
  ctx.fillStyle = "#f8fafc";
  roundRect(ctx, x, y, size, size, size * 0.18);
  ctx.fill();
  ctx.fillStyle = "#0a0b14";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.floor(size * 0.6)}px system-ui, sans-serif`;
  ctx.fillText(String(state.die), w / 2, h / 2 + size * 0.02);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "20px system-ui, sans-serif";
  ctx.fillText("Press A to stop", w / 2, y + size + 34);
}

function drawBanner(ctx: CanvasRenderingContext2D, text: string, w: number, h: number): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 28px system-ui, sans-serif";
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(10,11,20,0.85)";
  roundRect(ctx, w / 2 - tw / 2 - 24, h / 2 - 28, tw + 48, 56, 12);
  ctx.fill();
  ctx.fillStyle = "#fbbf24";
  ctx.fillText(text, w / 2, h / 2);
}

function drawCenterCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  subtitle: string,
): void {
  ctx.fillStyle = "rgba(5,6,12,0.78)";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 48px system-ui, sans-serif";
  ctx.fillText(title, w / 2, h / 2 - 24);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText(subtitle, w / 2, h / 2 + 28);
}

function drawPayout(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
): void {
  ctx.fillStyle = "rgba(5,6,12,0.82)";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.fillText(`${state.mgName} — results`, w / 2, h * 0.24);

  const rowH = Math.min(50, h * 0.09);
  const startY = h * 0.38;
  state.payout.forEach((row, i) => {
    const y = startY + i * rowH;
    ctx.fillStyle = row.color;
    ctx.beginPath();
    ctx.arc(w / 2 - 150, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "left";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillText(`${i + 1}.  ${row.name}`, w / 2 - 125, y);
    ctx.textAlign = "right";
    ctx.fillStyle = row.coins > 0 ? "#fbbf24" : "#6b7280";
    ctx.fillText(row.coins > 0 ? `+${row.coins} ◉` : "—", w / 2 + 160, y);
  });
}

function drawResults(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
): void {
  ctx.fillStyle = "rgba(5,6,12,0.9)";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 44px system-ui, sans-serif";
  ctx.fillText("Final Results", w / 2, h * 0.18);

  const ranked = [...state.players].sort((a, b) => b.stars - a.stars || b.coins - a.coins);
  const medals = ["🥇", "🥈", "🥉", "4th"];
  const rowH = Math.min(56, h * 0.1);
  const startY = h * 0.32;
  ranked.forEach((p, i) => {
    const y = startY + i * rowH;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(w / 2 - 200, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "left";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillText(`${medals[i] ?? ""}  ${p.name}`, w / 2 - 170, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`☆ ${p.stars}    ◉ ${p.coins}`, w / 2 + 220, y);
  });
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
