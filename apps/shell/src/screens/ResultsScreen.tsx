import { useShell } from "../store.js";
import { Btn } from "../components/Btn.js";
import { PLAYER_COLORS } from "../games.js";

const RANK_MEDALS = ["/icons/medal-gold.svg", "/icons/medal-silver.svg", "/icons/medal-bronze.svg"];

export function ResultsScreen() {
  const { lastResult, selectedGame, pairedSlots, profiles, navigate } = useShell();

  if (!lastResult) {
    return (
      <div className="screen results-screen">
        <p>No result to display.</p>
        <Btn id="results-home" onClick={() => navigate("home")} autoFocus>
          Home
        </Btn>
      </div>
    );
  }

  const sorted = [...lastResult.standings].sort((a, b) => a.rank - b.rank);

  return (
    <div className="screen results-screen">
      <h2 className="results-screen__title">Results</h2>
      {selectedGame && <p className="results-screen__game">{selectedGame.name}</p>}

      <ol className="results-screen__list">
        {sorted.map((standing) => {
          const slot = pairedSlots.find((s) => s.slot === standing.slot);
          const profile = profiles.find((p) => p.id === standing.profileId);
          const color = profile?.color ?? PLAYER_COLORS[standing.slot] ?? "#888";
          const name = profile?.name ?? (slot ? `P${standing.slot + 1}` : "Guest");
          const medal = RANK_MEDALS[standing.rank - 1];

          return (
            <li key={standing.slot} className="results-row">
              <span className="results-row__medal">
                {medal ? <img src={medal} alt={`${standing.rank} place`} /> : `${standing.rank}th`}
              </span>
              <span className="results-row__dot" style={{ background: color }} />
              <span className="results-row__name">{name}</span>
              {standing.score !== undefined && (
                <span className="results-row__score">{standing.score}</span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="results-screen__actions">
        <Btn id="results-again" onClick={() => navigate("pairing")} autoFocus>
          Play Again
        </Btn>
        <Btn id="results-home" onClick={() => navigate("home")} variant="ghost">
          Main Menu
        </Btn>
      </div>

      <footer className="home-screen__footer">
        <span className="hint">D-pad / stick to navigate · A to select · B for main menu</span>
      </footer>
    </div>
  );
}
