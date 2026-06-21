import type { PlayerInput } from "../game.js";
import type { Minigame, MinigamePlayer } from "./types.js";

const DURATION_MS = 15000;
const SPEED = 0.55; // normalized units per second
const GRAB_DIST = 0.06; // pickup radius in normalized space

/**
 * Scramble. A coin keeps popping up around the arena; move with the stick/d-pad
 * to grab it. Most coins when the clock runs out wins. Positions are kept in
 * normalized [0,1] space and scaled at render time.
 */
export function coinGrab(players: MinigamePlayer[]): Minigame {
  const pos = players.map((_, i) => ({
    x: 0.2 + (0.6 * i) / Math.max(1, players.length - 1),
    y: 0.5,
  }));
  const score = players.map(() => 0);
  let coin = randomSpot();
  let elapsed = 0;

  function randomSpot(): { x: number; y: number } {
    return { x: 0.1 + Math.random() * 0.8, y: 0.15 + Math.random() * 0.7 };
  }

  return {
    id: "coin-grab",
    name: "Coin Grab",
    rules: "Race to the coins! Grab the most before time runs out.",

    update(dtMs: number, inputs: PlayerInput[]): void {
      elapsed += dtMs;
      const dt = dtMs / 1000;
      for (let i = 0; i < players.length; i++) {
        const inp = inputs[i]!;
        const p = pos[i]!;
        // Normalize diagonal so stick + d-pad don't overspeed.
        let dx = inp.dx;
        let dy = inp.dy;
        const mag = Math.hypot(dx, dy);
        if (mag > 1) {
          dx /= mag;
          dy /= mag;
        }
        p.x = clamp01(p.x + dx * SPEED * dt);
        p.y = clamp01(p.y + dy * SPEED * dt);

        if (Math.hypot(p.x - coin.x, p.y - coin.y) <= GRAB_DIST) {
          score[i]!++;
          coin = randomSpot();
        }
      }
    },

    render(ctx, w, h): void {
      ctx.fillStyle = "#052e16";
      ctx.fillRect(0, 0, w, h);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#bbf7d0";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.fillText(`Coin Grab — ${Math.ceil((DURATION_MS - elapsed) / 1000)}s`, w / 2, 28);

      // coin
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(coin.x * w, coin.y * h, GRAB_DIST * Math.min(w, h) * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // players
      players.forEach((p, i) => {
        const a = pos[i]!;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(a.x * w, a.y * h, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0a0b14";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.fillText(`${p.name}: ${score[i]}`, a.x * w, a.y * h - 28);
      });
    },

    done(): boolean {
      return elapsed >= DURATION_MS;
    },

    placements(): number[] {
      return players.map((_, i) => i).sort((a, b) => score[b]! - score[a]!);
    },
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
