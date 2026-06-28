import type { Arena } from "../types.js";
import { BARNYARD } from "./barnyard.js";
import { COOP } from "./coop.js";
import { HENHOUSE } from "./henhouse.js";
import { ROOST } from "./roost.js";
import { SILO } from "./silo.js";
import { WINDMILL } from "./windmill.js";

export const ARENAS: Arena[] = [BARNYARD, SILO, WINDMILL, HENHOUSE, COOP, ROOST];

/** "all" cycles the catalog in order; "random" picks while avoiding repeats. */
export type ArenaPool = "all" | "random";

/**
 * Pick the arena for a given round.
 * - "all" (default): cycle ARENAS in catalog order.
 * - "random": deterministic pick keyed on (seed, round) that never picks the
 *   immediately previous arena.
 */
export function pickArena(round: number, pool: ArenaPool = "all", seed = 0, prevId?: string): Arena {
  if (pool === "random") return pickRandomArena(round, seed, prevId);
  return ARENAS[(round - 1) % ARENAS.length];
}

function pickRandomArena(round: number, seed: number, prevId?: string): Arena {
  let s = (seed ^ (round * 2654435761)) | 0;
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  let idx = s % ARENAS.length;
  if (prevId && ARENAS[idx].id === prevId && ARENAS.length > 1) {
    idx = (idx + 1) % ARENAS.length;
  }
  return ARENAS[idx];
}
