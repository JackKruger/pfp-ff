/**
 * @pfp/data — local-first persistence: profiles + immutable match records, with
 * derived stats and (later) achievements/overall score. See §7. Implemented in
 * Phase 2.
 */
import type { PlayerStanding } from "@pfp/sdk";

export interface Profile {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  createdAt: number;
  lastPlayedAt: number;
}

/** Immutable record of one game played — the source of truth for all stats. */
export interface MatchRecord {
  id: string;
  gameId: string;
  playedAt: number;
  standings: PlayerStanding[];
  gameStats?: Record<string, unknown>;
}

// Phase 2: DataStore interface + IndexedDB implementation + derived-stats queries.
