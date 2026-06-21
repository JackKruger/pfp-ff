import { GameCard } from "../components/GameCard.js";
import { Btn } from "../components/Btn.js";
import { GAMES } from "../games.js";
import { useShell } from "../store.js";
import type { GameManifest } from "@pfp/sdk";

export function HomeScreen() {
  const { navigate, selectGame } = useShell();

  function handleSelectGame(game: GameManifest) {
    selectGame(game);
    navigate("pairing");
  }

  return (
    <div className="screen home-screen">
      <header className="home-screen__header">
        <h1 className="home-screen__title">PFP-FF</h1>
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
