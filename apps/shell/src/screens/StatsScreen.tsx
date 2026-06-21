import { useMemo } from "react";
import { computeLeaderboard } from "@pfp/data";
import { useShell } from "../store.js";
import { Btn } from "../components/Btn.js";

export function StatsScreen() {
  const { matches, profiles, navigate } = useShell();

  const board = useMemo(() => computeLeaderboard(matches), [matches]);

  function profileName(id: string): string {
    return profiles.find((p) => p.id === id)?.name ?? id;
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
              </li>
            );
          })}
        </ol>
      )}

      <div className="stats-screen__actions">
        <Btn id="stats-back" onClick={() => navigate("home")} variant="ghost" autoFocus>
          ← Back
        </Btn>
      </div>
    </div>
  );
}
