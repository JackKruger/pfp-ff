import type { Arena } from "../types.js";
import { BARNYARD } from "./barnyard.js";
import { SILO } from "./silo.js";
import { WINDMILL } from "./windmill.js";

export const ARENAS: Arena[] = [BARNYARD, SILO, WINDMILL];

export function pickArena(round: number): Arena {
  return ARENAS[(round - 1) % ARENAS.length];
}
