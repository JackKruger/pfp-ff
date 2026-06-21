import { GameCard } from "../components/GameCard.js";
import { Btn } from "../components/Btn.js";
import { GAMES } from "../games.js";
import type { GameEntry } from "../games.js";
import { useShell } from "../store.js";

export function HomeScreen() {
  const { navigate, selectGame } = useShell();

  function handleSelectGame(game: GameEntry) {
    if (game.disabled) return;
    selectGame(game);
    navigate("pairing");
  }

  return (
    <div className="screen home-screen">
      <header className="home-screen__header">
        <img className="home-screen__wordmark" src="/brand/pfp-ff-wordmark.svg" alt="PFP-FF" />
        <nav className="home-screen__nav">
          <Btn id="nav-profiles" onClick={() => navigate("profiles")} variant="ghost">
            Profiles
          </Btn>
          <Btn id="nav-stats" onClick={() => navigate("stats")} variant="ghost">
            Stats
          </Btn>
        </nav>
      </header>

      <main className="home-screen__shelf">
        {GAMES.map((game, i) => (
          <GameCard
            key={game.id}
            game={game}
            disabled={game.disabled}
            onSelect={() => handleSelectGame(game)}
            autoFocus={i === 0}
          />
        ))}
      </main>

      <footer className="home-screen__footer">
        <span className="hint">D-pad to navigate · A to select</span>
      </footer>
    </div>
  );
}
