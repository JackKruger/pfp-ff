import { useEffect, useMemo, useState } from "react";
import { useFocusable } from "@pfp/ui";
import { GameCard } from "../components/GameCard.js";
import { Btn } from "../components/Btn.js";
import { GAMES, CATEGORY_LABELS } from "../games.js";
import type { GameCategory, GameEntry } from "../games.js";
import { useShell } from "../store.js";
import { useShellTicker } from "../ticker.js";

type Filter = "all" | "soon" | GameCategory;

/** Live count of connected gamepads, polled off the shared ticker. */
function useConnectedControllers(): number {
  const ticker = useShellTicker();
  const [count, setCount] = useState(0);
  useEffect(
    () =>
      ticker.onTick(() => {
        const n = ticker.poller.connectedIndices().length;
        setCount((prev) => (prev === n ? prev : n));
      }),
    [ticker],
  );
  return count;
}

/** A focusable filter chip. Selecting it switches the active library filter. */
function FilterTab({
  id,
  label,
  active,
  onSelect,
}: {
  id: string;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const { ref, focused } = useFocusable<HTMLButtonElement>(id, onSelect);
  return (
    <button
      ref={ref}
      className={`filter-tab${active ? " filter-tab--active" : ""}${focused ? " filter-tab--focused" : ""}`}
      onClick={onSelect}
      aria-pressed={active}
      tabIndex={-1}
    >
      {label}
    </button>
  );
}

/** Big featured banner for the spotlight game. */
function Hero({ game, onPlay }: { game: GameEntry; onPlay: () => void }) {
  const { ref, focused } = useFocusable<HTMLButtonElement>("hero-play", onPlay, {
    autoFocus: true,
  });
  const heroArt = game.heroArt ?? game.thumbnail;

  return (
    <section
      className="hero"
      style={{ ["--accent" as string]: game.accent }}
      aria-label="Featured game"
    >
      <div className="hero__art" aria-hidden="true">
        {heroArt ? (
          <img src={heroArt} alt="" />
        ) : (
          <span className="hero__art-icon">{game.icon}</span>
        )}
      </div>
      <div className="hero__body">
        <span className="hero__eyebrow">★ Featured</span>
        <h2 className="hero__title">{game.name}</h2>
        <p className="hero__blurb">{game.blurb}</p>
        <div className="hero__actions">
          <button
            ref={ref}
            className={`btn btn--play hero__play${focused ? " btn--focused" : ""}`}
            onClick={onPlay}
            tabIndex={-1}
          >
            <span aria-hidden="true">▶</span> Play now
          </button>
          <span className="hero__meta">
            {game.players.min === game.players.max
              ? `${game.players.min} players`
              : `${game.players.min}–${game.players.max} players`}{" "}
            · {game.tags?.slice(0, 2).join(" · ")}
          </span>
        </div>
      </div>
    </section>
  );
}

export function HomeScreen() {
  const { navigate, selectGame, profiles } = useShell();
  const [filter, setFilter] = useState<Filter>("all");
  const controllers = useConnectedControllers();

  const featured = useMemo(() => GAMES.find((g) => g.featured) ?? GAMES[0], []);

  function handleSelectGame(game: GameEntry) {
    if (game.disabled) return;
    selectGame(game);
    navigate("pairing");
  }

  const tabs: { key: Filter; label: string }[] = useMemo(() => {
    const cats = Array.from(new Set(GAMES.map((g) => g.category)));
    return [
      { key: "all", label: "All" },
      ...cats.map((c) => ({ key: c as Filter, label: CATEGORY_LABELS[c] })),
      { key: "soon", label: "Coming Soon" },
    ];
  }, []);

  const visible = useMemo(
    () =>
      GAMES.filter((g) => {
        if (filter === "all") return true;
        if (filter === "soon") return g.disabled;
        return g.category === filter && !g.disabled;
      }),
    [filter],
  );

  return (
    <div className="screen home-screen">
      <header className="home-screen__header">
        <img className="home-screen__wordmark" src="/brand/pfp-ff-wordmark.svg" alt="PFP-FF" />
        <nav className="home-screen__nav">
          <span className="controller-chip" title={`${controllers} controller(s) connected`}>
            <img src="/icons/gamepad.svg" alt="" aria-hidden="true" />
            <span>{controllers ? `${controllers} connected` : "No controllers"}</span>
          </span>
          <Btn id="nav-profiles" onClick={() => navigate("profiles")} variant="ghost">
            👤 Profiles{profiles.length ? ` · ${profiles.length}` : ""}
          </Btn>
          <Btn id="nav-stats" onClick={() => navigate("stats")} variant="ghost">
            📊 Stats
          </Btn>
        </nav>
      </header>

      <Hero game={featured} onPlay={() => handleSelectGame(featured)} />

      <div className="home-screen__filters" role="tablist" aria-label="Filter games">
        {tabs.map((t) => (
          <FilterTab
            key={t.key}
            id={`filter-${t.key}`}
            label={t.label}
            active={filter === t.key}
            onSelect={() => setFilter(t.key)}
          />
        ))}
      </div>

      <main className="home-screen__shelf" aria-label="Game library">
        {visible.map((game, i) => (
          <GameCard
            key={game.id}
            game={game}
            index={i}
            disabled={game.disabled}
            onSelect={() => handleSelectGame(game)}
          />
        ))}
        {visible.length === 0 && (
          <p className="home-screen__empty">No games in this category yet.</p>
        )}
      </main>

      <footer className="home-screen__footer">
        <span className="hint">D-pad to navigate · A to select · B to go back</span>
      </footer>
    </div>
  );
}
