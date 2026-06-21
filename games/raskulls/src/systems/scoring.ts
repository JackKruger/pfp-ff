import type { ArenaRankInput, RaceRankInput, RankedPlayer } from "./types.js";

export function rankRacePlayers(players: RaceRankInput[], timeoutMs: number): RankedPlayer[] {
  const sorted = [...players].sort((a, b) => compareRace(a, b));
  return assignRanks(sorted, compareRace).map((entry) => ({
    slot: entry.slot,
    profileId: entry.profileId,
    rank: entry.rank,
    score: raceScore(entry, timeoutMs),
    stats: entry.stats,
  }));
}

export function rankArenaPlayers(players: ArenaRankInput[]): RankedPlayer[] {
  const sorted = [...players].sort((a, b) => compareArena(a, b));
  return assignRanks(sorted, compareArena).map((entry) => ({
    slot: entry.slot,
    profileId: entry.profileId,
    rank: entry.rank,
    score: arenaScore(entry),
    stats: entry.stats,
  }));
}

function compareRace(a: RaceRankInput, b: RaceRankInput): number {
  const aFinished = a.stats.finishMs !== undefined;
  const bFinished = b.stats.finishMs !== undefined;
  if (aFinished && bFinished) return (a.stats.finishMs ?? 0) - (b.stats.finishMs ?? 0);
  if (aFinished !== bFinished) return aFinished ? -1 : 1;
  if (a.progress !== b.progress) return b.progress - a.progress;
  if (a.stats.gems !== b.stats.gems) return b.stats.gems - a.stats.gems;
  if (a.stats.blocksBroken !== b.stats.blocksBroken) {
    return b.stats.blocksBroken - a.stats.blocksBroken;
  }
  return a.slot - b.slot;
}

function compareArena(a: ArenaRankInput, b: ArenaRankInput): number {
  if (a.alive !== b.alive) return a.alive ? -1 : 1;
  if (a.lives !== b.lives) return b.lives - a.lives;
  if (a.stats.eliminations !== b.stats.eliminations) {
    return b.stats.eliminations - a.stats.eliminations;
  }
  if (a.stats.gems !== b.stats.gems) return b.stats.gems - a.stats.gems;
  if (a.stats.deaths !== b.stats.deaths) return a.stats.deaths - b.stats.deaths;
  return a.slot - b.slot;
}

function raceScore(player: RaceRankInput, timeoutMs: number): number {
  if (player.stats.finishMs !== undefined) {
    const timeScore = Math.max(1, Math.round((timeoutMs - player.stats.finishMs) / 100));
    return timeScore + player.stats.gems * 25 + player.stats.blocksBroken * 3;
  }
  return Math.round(player.progress) + player.stats.gems * 25 + player.stats.blocksBroken * 3;
}

function arenaScore(player: ArenaRankInput): number {
  return (
    player.stats.eliminations * 100 +
    player.stats.gems * 20 +
    player.lives * 15 -
    player.stats.deaths * 10
  );
}

function assignRanks<T extends { slot: number }>(
  sorted: T[],
  compare: (a: T, b: T) => number,
): Array<T & { rank: number }> {
  let rank = 0;
  return sorted.map((entry, index) => {
    if (index === 0 || compare(sorted[index - 1] as T, entry) !== 0) rank = index + 1;
    return { ...entry, rank };
  });
}
