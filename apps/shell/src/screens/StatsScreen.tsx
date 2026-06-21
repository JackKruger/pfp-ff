import { useMemo } from "react";
import { computeLeaderboard } from "@pfp/data";
import { useShell } from "../store.js";
import { Btn } from "../components/Btn.js";
import { GAMES, PLAYER_COLORS } from "../games.js";

const RANK_MEDALS = ["/icons/medal-gold.svg", "/icons/medal-silver.svg", "/icons/medal-bronze.svg"];

export function StatsScreen() {
  const { matches, profiles, navigate } = useShell();

  const board = useMemo(() => computeLeaderboard(matches), [matches]);
  const gameById = useMemo(() => new Map(GAMES.map((game) => [game.id, game])), []);

  function profileName(id: string | null, slot?: number): string {
    if (id) return profiles.find((p) => p.id === id)?.name ?? id;
    return slot === undefined ? "Guest" : `P${slot + 1}`;
  }

  function profileColor(id: string | null, slot: number): string {
    return profiles.find((p) => p.id === id)?.color ?? PLAYER_COLORS[slot] ?? "#8b95b8";
  }

  function statLabel(gameId: string, key: string): string {
    return (
      gameById.get(gameId)?.statKeys?.[key]?.label ??
      key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase())
    );
  }

  function formatStatValue(key: string, value: unknown): string {
    if (typeof value === "number") {
      if (key.toLowerCase().endsWith("ms")) {
        return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
      }
      return String(value);
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  }

  return (
    <div className="screen stats-screen">
      <header className="stats-screen__header">
        <img src="/icons/trophy.svg" alt="" aria-hidden="true" />
        <h2>Leaderboard</h2>
      </header>

      {board.length === 0 ? (
        <p className="stats-screen__empty">No matches recorded yet. Play a game!</p>
      ) : (
        <ol className="stats-screen__board">
          {board.map((entry, i) => {
            const profile = profiles.find((p) => p.id === entry.profileId);
            const color = profile?.color;
            return (
              <li key={entry.profileId} className="stats-row">
                <span className="stats-row__rank">
                  {i < 3 ? (
                    <img
                      src={
                        [
                          "/icons/medal-gold.svg",
                          "/icons/medal-silver.svg",
                          "/icons/medal-bronze.svg",
                        ][i]
                      }
                      alt={`Rank ${i + 1}`}
                    />
                  ) : (
                    `#${i + 1}`
                  )}
                </span>
                {color && <span className="stats-row__dot" style={{ background: color }} />}
                <span className="stats-row__name">{profileName(entry.profileId)}</span>
                <span className="stats-row__wins">{entry.wins}W</span>
                <span className="stats-row__played">{entry.played}G</span>
                <span className="stats-row__rate">{Math.round(entry.winRate * 100)}%</span>
                {entry.bestScore !== undefined && (
                  <span className="stats-row__best">Best {entry.bestScore}</span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {matches.length > 0 && (
        <section className="stats-history" aria-labelledby="stats-history-title">
          <h3 id="stats-history-title" className="stats-history__title">
            Recent Matches
          </h3>
          <ol className="stats-history__list">
            {matches.map((match) => {
              const game = gameById.get(match.gameId);
              const matchStats = Object.entries(match.gameStats ?? {});
              const sorted = [...match.standings].sort(
                (a, b) => a.rank - b.rank || a.slot - b.slot,
              );

              return (
                <li key={match.id} className="match-stats">
                  <div className="match-stats__header">
                    <div>
                      <h4>{game?.name ?? match.gameId}</h4>
                      <time dateTime={new Date(match.playedAt).toISOString()}>
                        {new Date(match.playedAt).toLocaleString()}
                      </time>
                    </div>
                    {matchStats.length > 0 && (
                      <dl className="match-stats__chips">
                        {matchStats.map(([key, value]) => (
                          <div key={key} className="stat-chip">
                            <dt>{statLabel(match.gameId, key)}</dt>
                            <dd>{formatStatValue(key, value)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>

                  <ol className="match-stats__players">
                    {sorted.map((standing) => {
                      const medal = RANK_MEDALS[standing.rank - 1];
                      const playerStats = Object.entries(standing.stats ?? {});

                      return (
                        <li key={standing.slot} className="match-player">
                          <span className="match-player__rank">
                            {medal ? (
                              <img src={medal} alt={`${standing.rank} place`} />
                            ) : (
                              `#${standing.rank}`
                            )}
                          </span>
                          <span
                            className="match-player__dot"
                            style={{ background: profileColor(standing.profileId, standing.slot) }}
                          />
                          <span className="match-player__name">
                            {profileName(standing.profileId, standing.slot)}
                          </span>
                          {standing.score !== undefined && (
                            <span className="match-player__score">Score {standing.score}</span>
                          )}
                          {playerStats.length > 0 && (
                            <dl className="match-player__stats">
                              {playerStats.map(([key, value]) => (
                                <div key={key} className="stat-chip">
                                  <dt>{statLabel(match.gameId, key)}</dt>
                                  <dd>{formatStatValue(key, value)}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="stats-screen__actions">
        <Btn id="stats-back" onClick={() => navigate("home")} variant="ghost" autoFocus>
          ← Back
        </Btn>
      </div>
    </div>
  );
}
