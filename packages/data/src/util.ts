/**
 * Shared helpers used by every DataStore implementation so they behave
 * identically — id generation, query filtering/sorting, and the patch helper
 * all live here rather than being duplicated per backend.
 */
import type { MatchQuery, MatchRecord } from "./types.js";

/**
 * Generate a unique id. Prefers crypto.randomUUID, but that is only available in
 * secure contexts (HTTPS/localhost) — for plain-HTTP LAN play we fall back to a
 * v4 UUID built from getRandomValues (or Math.random as a last resort).
 */
export function newId(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return uuidV4Fallback(c);
}

function uuidV4Fallback(c: Crypto | undefined): string {
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Deterministic tiebreak so the two stores order equal-timestamp records
 * identically (IndexedDB getAll returns key order, the memory store insertion
 * order — without this they would diverge on equal playedAt/createdAt).
 */
export function compareById(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** True if the given profile participated in the match. */
export function matchHasProfile(match: MatchRecord, profileId: string): boolean {
  return match.standings.some((standing) => standing.profileId === profileId);
}

/** Apply a MatchQuery: filter, sort newest-first (id tiebreak), then limit. Pure. */
export function applyMatchQuery(records: MatchRecord[], query: MatchQuery = {}): MatchRecord[] {
  const result = records.filter((record) => {
    if (query.gameId !== undefined && record.gameId !== query.gameId) return false;
    if (query.profileId !== undefined && !matchHasProfile(record, query.profileId)) return false;
    if (query.since !== undefined && record.playedAt < query.since) return false;
    return true;
  });

  result.sort((a, b) => b.playedAt - a.playedAt || compareById(a, b));

  if (query.limit !== undefined && query.limit >= 0) {
    return result.slice(0, query.limit);
  }
  return result;
}

/** Drop keys whose value is undefined, for merge-patch semantics. */
export function stripUndefined<T extends object>(patch: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}
