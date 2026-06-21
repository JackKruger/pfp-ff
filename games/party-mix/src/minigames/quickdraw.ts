import type { PlayerInput } from "../game.js";
import { aEdges, type Minigame, type MinigamePlayer } from "./types.js";

const MIN_WAIT_MS = 1500;
const MAX_WAIT_MS = 4000;
const REACT_WINDOW_MS = 2500; // after GREEN, time allowed to react

type Result =
  | { kind: "reacted"; ms: number }
  | { kind: "missed" }
  | { kind: "false" };

/**
 * Reaction duel. The screen says WAIT, then turns GREEN at a random moment —
 * first to press A wins. Pressing before GREEN is a false start (ranked last).
 */
export function quickdraw(players: MinigamePlayer[]): Minigame {
  const waitMs = MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS);
  let elapsed = 0;
  let greenAt = -1;
  const results: (Result | null)[] = players.map(() => null);
  const prevA: boolean[] = players.map(() => false);

  function settled(): boolean {
    return results.every((r) => r !== null);
  }

  return {
    id: "quickdraw",
    name: "Quickdraw",
    rules: "Wait for GREEN, then SLAM A. Jump the gun and you're out.",

    update(dtMs: number, inputs: PlayerInput[]): void {
      elapsed += dtMs;
      if (greenAt < 0 && elapsed >= waitMs) greenAt = elapsed;

      const edges = aEdges(inputs, prevA);
      for (let i = 0; i < players.length; i++) {
        if (results[i]) continue;
        if (!edges[i]) continue;
        if (greenAt < 0) results[i] = { kind: "false" };
        else results[i] = { kind: "reacted", ms: elapsed - greenAt };
      }

      // Once green, anyone who never reacts within the window is "missed".
      if (greenAt >= 0 && elapsed - greenAt >= REACT_WINDOW_MS) {
        for (let i = 0; i < players.length; i++) {
          if (!results[i]) results[i] = { kind: "missed" };
        }
      }
    },

    render(ctx, w, h): void {
      const green = greenAt >= 0;
      ctx.fillStyle = green ? "#15803d" : "#7f1d1d";
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#f8fafc";
      ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.12)}px system-ui, sans-serif`;
      ctx.fillText(green ? "GREEN!  SLAM A!" : "WAIT…", w / 2, h * 0.4);

      // Per-player status row.
      const n = players.length;
      const colW = w / n;
      players.forEach((p, i) => {
        const x = colW * (i + 0.5);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, h * 0.66, 18, 0, Math.PI * 2);
        ctx.fill();
        const r = results[i];
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "bold 22px system-ui, sans-serif";
        let label = "…";
        if (r?.kind === "reacted") label = `${Math.round(r.ms)}ms`;
        else if (r?.kind === "false") label = "TOO SOON";
        else if (r?.kind === "missed") label = "—";
        ctx.fillText(label, x, h * 0.74);
        ctx.fillText(p.name, x, h * 0.82);
      });
    },

    done(): boolean {
      return settled();
    },

    placements(): number[] {
      // reacted (fastest first) → missed → false start.
      const order = (r: Result | null): number =>
        r?.kind === "reacted" ? 0 : r?.kind === "missed" ? 1 : 2;
      return players
        .map((_, i) => i)
        .sort((a, b) => {
          const ra = results[a];
          const rb = results[b];
          const ga = order(ra);
          const gb = order(rb);
          if (ga !== gb) return ga - gb;
          if (ra?.kind === "reacted" && rb?.kind === "reacted") return ra.ms - rb.ms;
          return 0;
        });
    },
  };
}
