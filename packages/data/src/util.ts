/**
 * Shared helpers used by every DataStore implementation so they behave
 * identically — query filtering/sorting lives here, not duplicated per backend.
 */
import type { MatchQuery, MatchRecord } from "./types.js";

export function newId(): string {
  return crypto.randomUUID();
}

/** True if the given profile participated in the match. */
export function matchHasProfile(match: MatchRecord, profileId: string): boolean {
  return match.standings.some((standing) => standing.profileId === profileId);
}

/** Apply a MatchQuery: filter, sort newest-first, then limit. Pure. */
export function applyMatchQuery(records: MatchRecord[], query: MatchQuery = {}): MatchRecord[] {
  let result = records.filter((record) => {
    if (query.gameId !== undefined && record.gameId !== query.gameId) return false;
    if (query.profileId !== undefined && !matchHasProfile(record, query.profileId)) return false;
    if (query.since !== undefined && record.playedAt < query.since) return false;
    return true;
  });

  result = result.sort((a, b) => b.playedAt - a.playedAt);

  if (query.limit !== undefined && query.limit >= 0) {
    result = result.slice(0, query.limit);
  }
  return result;
}
