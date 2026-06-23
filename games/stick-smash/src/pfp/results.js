export function buildStickSmashResult({ context, startedAt, endedAt, players, winner, reason }) {
  return {
    gameId: 'stick-smash',
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

export function buildStandings({ launchedPlayers, players, winner }) {
  const bySlot = new Map();
  for (const player of players ?? []) {
    if (!player) continue;
    const slot = player.pfpSlot ?? player.inputSource?.slot;
    if (slot == null) continue;
    bySlot.set(slot, player);
  }

  const rows = launchedPlayers.map((launchedPlayer) => {
    const player = bySlot.get(launchedPlayer.slot);
    return {
      slot: launchedPlayer.slot,
      profileId: launchedPlayer.profileId,
      rank: 1,
      score: player?.score ?? 0,
      stats: {
        kills: player?.score ?? 0,
        deaths: player?.deaths ?? 0,
        lives: player?.lives ?? 0,
      },
      _isWinner: Boolean(winner && player && winner === player),
    };
  });

  rows.sort((a, b) => {
    if (a._isWinner !== b._isWinner) return a._isWinner ? -1 : 1;
    return (
      (b.stats.lives - a.stats.lives) ||
      (b.score - a.score) ||
      (a.stats.deaths - b.stats.deaths) ||
      (a.slot - b.slot)
    );
  });

  let nextRank = winner ? 2 : 1;
  for (const row of rows) {
    row.rank = row._isWinner ? 1 : nextRank++;
    delete row._isWinner;
  }

  return rows.sort((a, b) => a.slot - b.slot);
}
