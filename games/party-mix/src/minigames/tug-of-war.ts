import type { PlayerInput } from "../game.js";
import { aEdges, type Minigame, type MinigamePlayer } from "./types.js";

const TARGET = 30; // A-presses to haul your flag to the top
const TIME_LIMIT_MS = 12000;

/**
 * Mash race. Every A press hauls your flag up the pole; first to the top wins.
 * When time runs out, remaining players are ranked by how high they got.
 */
export function tugOfWar(players: MinigamePlayer[]): Minigame {
  const progress = players.map(() => 0); // 0..TARGET
  const finishOrder: number[] = []; // player indices in the order they topped out
  const prevA: boolean[] = players.map(() => false);
  let elapsed = 0;

  return {
    id: "tug-of-war",
    name: "Tug of War",
    rules: "Mash A as fast as you can to haul your flag to the top!",

    update(dtMs: number, inputs: PlayerInput[]): void {
      elapsed += dtMs;
      const edges = aEdges(inputs, prevA);
      for (let i = 0; i < players.length; i++) {
        if (progress[i]! >= TARGET) continue;
        if (edges[i]) {
          progress[i] = Math.min(TARGET, progress[i]! + 1);
          if (progress[i]! >= TARGET) finishOrder.push(i);
        }
      }
    },

    render(ctx, w, h): void {
      ctx.fillStyle = "#1e1b4b";
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#f8fafc";
      ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.06)}px system-ui, sans-serif`;
      ctx.fillText("MASH A!", w / 2, h * 0.1);

      const n = players.length;
      const laneW = w / n;
      const top = h * 0.2;
      const bottom = h * 0.88;
      players.forEach((p, i) => {
        const cx = laneW * (i + 0.5);
        // pole
        ctx.strokeStyle = "#312e81";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cx, top);
        ctx.lineTo(cx, bottom);
        ctx.stroke();
        // flag at current height
        const t = progress[i]! / TARGET;
        const y = bottom - (bottom - top) * t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(cx, y, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "bold 20px system-ui, sans-serif";
        ctx.fillText(p.name, cx, bottom + 24);
      });
    },

    done(): boolean {
      // First flag to the top ends it; otherwise the clock decides.
      return finishOrder.length >= 1 || elapsed >= TIME_LIMIT_MS;
    },

    placements(): number[] {
      const finished = new Set(finishOrder);
      const rest = players
        .map((_, i) => i)
        .filter((i) => !finished.has(i))
        .sort((a, b) => progress[b]! - progress[a]!);
      return [...finishOrder, ...rest];
    },
  };
}
