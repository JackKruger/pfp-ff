import type { GameResult, PlayerSlot, PlayerStanding } from "@pfp/sdk";
import type { RankedPlayer, RaskullsMode } from "./types.js";

export interface BuildResultInput {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  mode: RaskullsMode;
  players: PlayerSlot[];
  ranked: RankedPlayer[];
}

export function buildGameResult(input: BuildResultInput): GameResult {
  const bySlot = new Map(input.ranked.map((standing) => [standing.slot, standing]));
  const standings: PlayerStanding[] = [];
  for (const player of input.players) {
    const ranked = bySlot.get(player.slot);
    if (!ranked) {
      console.error("buildGameResult: missing result for slot", player.slot, "— skipping");
      continue;
    }
    standings.push({
      slot: player.slot,
      profileId: player.profileId,
      rank: ranked.rank,
      score: ranked.score,
      stats: {
        blocksBroken: ranked.stats.blocksBroken,
        gems: ranked.stats.gems,
        eliminations: ranked.stats.eliminations,
        deaths: ranked.stats.deaths,
        finishMs: ranked.stats.finishMs ?? 0,
      },
    });
  }

  return {
    gameId: "raskulls",
    sessionId: input.sessionId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    standings,
    gameStats: {
      mode: input.mode,
      durationMs: input.endedAt - input.startedAt,
    },
  };
}
