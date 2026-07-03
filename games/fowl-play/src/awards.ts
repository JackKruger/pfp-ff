import type { Player } from "./types.js";

/**
 * End-of-match awards, derived from the per-player stats the match already
 * tracks. Purely cosmetic — no points attached — but they give every player
 * (not just the winner) a moment on the final screen.
 */

export interface Award {
  id: string;
  title: string;
  /** Slot of the player who earned it. */
  slot: number;
  /** Stat line shown under the title, e.g. "3 trap kills". */
  detail: string;
}

interface AwardSpec {
  id: string;
  title: string;
  stat: (p: Player) => number;
  detail: (n: number) => string;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** Ordered by prestige — the list is truncated from the bottom when space runs out. */
const SPECS: AwardSpec[] = [
  {
    id: "menace",
    title: "Menace",
    stat: (p) => p.score.killsCaused,
    detail: (n) => plural(n, "trap kill"),
  },
  {
    id: "trackStar",
    title: "Track Star",
    stat: (p) => p.score.finishes,
    detail: (n) => (n === 1 ? "1 finish" : `${n} finishes`),
  },
  {
    id: "soleSurvivor",
    title: "Sole Survivor",
    stat: (p) => p.score.loneSurvivor,
    detail: (n) => plural(n, "lone finish"),
  },
  {
    id: "magpie",
    title: "Magpie",
    stat: (p) => p.score.coinsCollected,
    detail: (n) => plural(n, "coin"),
  },
  {
    id: "architect",
    title: "Architect",
    stat: (p) => p.score.trapsPlaced,
    detail: (n) => plural(n, "piece"),
  },
  {
    id: "lemming",
    title: "Lemming",
    stat: (p) => p.score.selfKills,
    detail: (n) => plural(n, "own-trap death"),
  },
  {
    id: "crashDummy",
    title: "Crash Test Dummy",
    stat: (p) => p.score.deaths,
    detail: (n) => plural(n, "death"),
  },
];

/**
 * Compute up to `max` awards. An award is only handed out when a single player
 * strictly leads that stat (ties get nothing) and the value is non-zero.
 */
export function computeAwards(players: Player[], max = 4): Award[] {
  const out: Award[] = [];
  for (const spec of SPECS) {
    if (out.length >= max) break;
    let top: Player | null = null;
    let topVal = 0;
    let tie = false;
    for (const p of players) {
      const v = spec.stat(p);
      if (v > topVal) {
        topVal = v;
        top = p;
        tie = false;
      } else if (v === topVal && v > 0) {
        tie = true;
      }
    }
    if (top && !tie && topVal > 0) {
      out.push({ id: spec.id, title: spec.title, slot: top.slot, detail: spec.detail(topVal) });
    }
  }
  return out;
}
