import type { PlayerStats, RankedPlayer } from "./types.js";

export interface GrandPrixEntry {
  slot: number;
  profileId: string | null;
  points: number;
  stats: PlayerStats;
}

export interface GrandPrixState {
  levelIds: string[];
  currentIndex: number;
  entries: GrandPrixEntry[];
}

const POINTS_BY_PLACE = [5, 3, 2, 1] as const;

export function createGrandPrixState(
  levelIds: string[],
  players: Array<{ slot: number; profileId: string | null }>,
): GrandPrixState {
  return {
    levelIds,
    currentIndex: 0,
    entries: players.map((player) => ({
      slot: player.slot,
      profileId: player.profileId,
      points: 0,
      stats: emptyStats(),
    })),
  };
}

export function currentGrandPrixLevelId(state: GrandPrixState): string {
  return state.levelIds[state.currentIndex] ?? state.levelIds[0] ?? "";
}

export function hasNextGrandPrixRound(state: GrandPrixState): boolean {
  return state.currentIndex < state.levelIds.length - 1;
}

export function advanceGrandPrixRound(state: GrandPrixState): void {
  state.currentIndex = Math.min(state.levelIds.length - 1, state.currentIndex + 1);
}

export function applyGrandPrixRound(state: GrandPrixState, ranked: RankedPlayer[]): void {
  for (const standing of ranked) {
    const entry = state.entries.find((candidate) => candidate.slot === standing.slot);
    if (!entry) continue;

    entry.points += POINTS_BY_PLACE[standing.rank - 1] ?? 0;
    entry.stats.blocksBroken += standing.stats.blocksBroken;
    entry.stats.gems += standing.stats.gems;
    entry.stats.eliminations += standing.stats.eliminations;
    entry.stats.deaths += standing.stats.deaths;
    if (standing.stats.finishMs !== undefined) {
      entry.stats.finishMs = Math.min(entry.stats.finishMs ?? Infinity, standing.stats.finishMs);
    }
  }
}

export function rankGrandPrix(state: GrandPrixState): RankedPlayer[] {
  const sorted = [...state.entries].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.stats.finishMs !== b.stats.finishMs) {
      return (a.stats.finishMs ?? Infinity) - (b.stats.finishMs ?? Infinity);
    }
    if (a.stats.gems !== b.stats.gems) return b.stats.gems - a.stats.gems;
    return b.stats.blocksBroken - a.stats.blocksBroken;
  });

  return sorted.map((entry, index) => ({
    slot: entry.slot,
    profileId: entry.profileId,
    rank: index + 1,
    score: entry.points,
    stats: entry.stats,
  }));
}

function emptyStats(): PlayerStats {
  return {
    blocksBroken: 0,
    gems: 0,
    eliminations: 0,
    deaths: 0,
  };
}
