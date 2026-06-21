/**
 * Derived statistics — pure functions over match records. Nothing here is
 * stored; aggregates are always recomputed from the immutable record log, so we
 * can add new views without migrations (§7).
 *
 * Win definition: a standing with rank === 1 (ties for first all count as wins).
 */
import type { MatchRecord } from "./types.js";

export interface ProfileGameStats {
  gameId: string;
  played: number;
  wins: number;
  /** wins / played, in [0, 1]; 0 when never played. */
  winRate: number;
  /** Highest score this profile achieved in this game, if any reported. */
  bestScore?: number;
  /** epoch ms of the most recent match of this game. */
  lastPlayedAt?: number;
}

export interface ProfileStats {
  profileId: string;
  totalPlayed: number;
  totalWins: number;
  winRate: number;
  /** Per-game breakdown, sorted by most recently played first. */
  perGame: ProfileGameStats[];
}

export interface LeaderboardEntry {
  profileId: string;
  played: number;
  wins: number;
  winRate: number;
  bestScore?: number;
}

function isWin(rank: number): boolean {
  return rank === 1;
}

function rate(wins: number, played: number): number {
  return played === 0 ? 0 : wins / played;
}

function maxDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

/** Aggregate one profile's record across all games and per game. */
export function computeProfileStats(profileId: string, matches: MatchRecord[]): ProfileStats {
  const perGame = new Map<string, ProfileGameStats>();
  let totalPlayed = 0;
  let totalWins = 0;

  for (const match of matches) {
    const standing = match.standings.find((s) => s.profileId === profileId);
    if (!standing) continue;

    totalPlayed += 1;
    const won = isWin(standing.rank);
    if (won) totalWins += 1;

    const existing = perGame.get(match.gameId);
    const played = (existing?.played ?? 0) + 1;
    const wins = (existing?.wins ?? 0) + (won ? 1 : 0);
    perGame.set(match.gameId, {
      gameId: match.gameId,
      played,
      wins,
      winRate: rate(wins, played),
      bestScore: maxDefined(existing?.bestScore, standing.score),
      lastPlayedAt:
        existing?.lastPlayedAt === undefined
          ? match.playedAt
          : Math.max(existing.lastPlayedAt, match.playedAt),
    });
  }

  return {
    profileId,
    totalPlayed,
    totalWins,
    winRate: rate(totalWins, totalPlayed),
    perGame: [...perGame.values()].sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0)),
  };
}

/**
 * Build a leaderboard across profiles from match records. Pass `gameId` to scope
 * to one game; omit for an all-games leaderboard. Sorted by wins desc, then
 * win-rate desc, then games-played desc.
 */
export function computeLeaderboard(
  matches: MatchRecord[],
  options: { gameId?: string } = {},
): LeaderboardEntry[] {
  const scoped =
    options.gameId === undefined
      ? matches
      : matches.filter((match) => match.gameId === options.gameId);

  const byProfile = new Map<string, LeaderboardEntry>();

  for (const match of scoped) {
    // Count each profile at most once per match (its first standing), matching
    // computeProfileStats' .find() semantics, even if a profile somehow occupies
    // two slots of the same match.
    const counted = new Set<string>();
    for (const standing of match.standings) {
      if (standing.profileId === null) continue; // guests aren't ranked long-term
      const id = standing.profileId;
      if (counted.has(id)) continue;
      counted.add(id);
      const existing = byProfile.get(id);
      const played = (existing?.played ?? 0) + 1;
      const wins = (existing?.wins ?? 0) + (isWin(standing.rank) ? 1 : 0);
      byProfile.set(id, {
        profileId: id,
        played,
        wins,
        winRate: rate(wins, played),
        bestScore: maxDefined(existing?.bestScore, standing.score),
      });
    }
  }

  return [...byProfile.values()].sort(
    (a, b) => b.wins - a.wins || b.winRate - a.winRate || b.played - a.played,
  );
}
