/**
 * Data model for the persistence layer. See docs/ARCHITECTURE.md §7.
 *
 * Match records are immutable and the source of truth; all aggregate stats are
 * derived from them (see stats.ts), never stored as a primary copy.
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

/** Fields a caller supplies to create a profile; the store fills the rest. */
export interface NewProfile {
  name: string;
  color: string;
  avatar?: string;
}

/** Mutable fields of a profile. */
export interface ProfileUpdate {
  name?: string;
  color?: string;
  avatar?: string;
  lastPlayedAt?: number;
}

/** Immutable record of one game played — the source of truth for all stats. */
export interface MatchRecord {
  id: string;
  gameId: string;
  /** epoch ms */
  playedAt: number;
  standings: PlayerStanding[];
  gameStats?: Record<string, unknown>;
}

/** Fields a caller supplies to record a match; the store fills id/playedAt. */
export interface NewMatchRecord {
  gameId: string;
  /** Defaults to now if omitted. */
  playedAt?: number;
  standings: PlayerStanding[];
  gameStats?: Record<string, unknown>;
}

/** Filter for listing matches. All fields optional; combined with AND. */
export interface MatchQuery {
  gameId?: string;
  /** Matches in which this profile participated. */
  profileId?: string;
  /** Only matches played at or after this epoch ms. */
  since?: number;
  /** Cap the number returned (after newest-first sorting). */
  limit?: number;
}
