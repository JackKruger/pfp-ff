/**
 * Maps upstream Stick Smash players to a PFP GameResult. The winner (if any)
 * always ranks first; everyone else is ordered by lives, then kills, then
 * fewest deaths. Launched players the upstream match never spawned (it needs
 * MIN_FIGHTERS) still get a standing so every slot is accounted for.
 */
import type { GameResult, LaunchContext, PlayerSlot, PlayerStanding } from "@pfp/sdk";

/** The slice of an upstream `Game` player the adapter reads. Upstream is an
 *  untyped submodule, so this is a structural contract, not its real type. */
export interface StickSmashPlayer {
  pfpSlot?: number;
  inputSource?: { slot?: number };
  score?: number;
  deaths?: number;
  lives?: number;
}

export interface StickSmashMatchOutcome {
  context: LaunchContext;
  startedAt: number;
  endedAt: number;
  players: readonly (StickSmashPlayer | null | undefined)[] | null | undefined;
  winner: StickSmashPlayer | null | undefined;
  reason?: string;
}

export function buildStickSmashResult(outcome: StickSmashMatchOutcome): GameResult {
  const { context, startedAt, endedAt, players, winner, reason } = outcome;
  return {
    gameId: "stick-smash",
    sessionId: context.sessionId,
    startedAt,
    endedAt,
    standings: buildStandings({ launchedPlayers: context.players, players, winner }),
    gameStats: {
      durationMs: endedAt - startedAt,
      reason,
    },
  };
}

export function buildStandings({
  launchedPlayers,
  players,
  winner,
}: {
  launchedPlayers: readonly PlayerSlot[];
  players: StickSmashMatchOutcome["players"];
  winner: StickSmashMatchOutcome["winner"];
}): PlayerStanding[] {
  const bySlot = new Map<number, StickSmashPlayer>();
  for (const player of players ?? []) {
    if (!player) continue;
    const slot = player.pfpSlot ?? player.inputSource?.slot;
    if (slot == null) continue;
    bySlot.set(slot, player);
  }

  const rows = launchedPlayers.map((launchedPlayer) => {
    const player = bySlot.get(launchedPlayer.slot);
    return {
      standing: {
        slot: launchedPlayer.slot,
        profileId: launchedPlayer.profileId,
        rank: 1,
        score: player?.score ?? 0,
        stats: {
          kills: player?.score ?? 0,
          deaths: player?.deaths ?? 0,
          lives: player?.lives ?? 0,
        },
      } satisfies PlayerStanding & { stats: Record<string, number> },
      isWinner: Boolean(winner && player && winner === player),
    };
  });

  rows.sort((a, b) => {
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    return (
      b.standing.stats.lives - a.standing.stats.lives ||
      (b.standing.score ?? 0) - (a.standing.score ?? 0) ||
      a.standing.stats.deaths - b.standing.stats.deaths ||
      a.standing.slot - b.standing.slot
    );
  });

  let nextRank = winner ? 2 : 1;
  for (const row of rows) {
    row.standing.rank = row.isWinner ? 1 : nextRank++;
  }

  return rows.map((row) => row.standing).sort((a, b) => a.slot - b.slot);
}
