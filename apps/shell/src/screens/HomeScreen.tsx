import { useEffect, useMemo, useRef, useState } from "react";
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

const SLOTS = [
  { slot: 0, corner: "tl" },
  { slot: 1, corner: "tr" },
  { slot: 2, corner: "bl" },
  { slot: 3, corner: "br" },
] as const;

export function HomeScreen() {
  const {
    navigate,
    selectGame,
    clearGame,
    pairedSlots,
    profiles,
    addSessionSlot,
    removeSessionSlot,
  } = useShell();
  const ticker = useShellTicker();
  const [filter, setFilter] = useState<Filter>("all");
  const [connectedIndices, setConnectedIndices] = useState<number[]>([]);
  const [showPlayers, setShowPlayers] = useState(false);
  const controllers = useConnectedControllers();

  const featured = useMemo(() => GAMES.find((g) => g.featured) ?? GAMES[0], []);

  // Ref so the tick closure can read current modal state without re-subscribing.
  const showPlayersRef = useRef(showPlayers);
  useEffect(() => {
    showPlayersRef.current = showPlayers;
  }, [showPlayers]);

  useEffect(() => {
    return ticker.onTick(() => {
      const poller = ticker.poller;
      const connected = poller.connectedIndices();
      setConnectedIndices(connected);

      const connectedSet = new Set(connected);

      // Read live store state so we always see post-mutation values within the same tick.
      const { pairedSlots: slots } = useShell.getState();
      const joinedSet = new Set(slots.filter((s) => s.gamepadIndex >= 0).map((s) => s.gamepadIndex));

      // If the Players modal is open, any B press closes it — don't process join/leave.
      if (showPlayersRef.current) {
        for (const idx of connected) {
          if (poller.justPressed(idx, "b")) {
            setShowPlayers(false);
            return;
          }
        }
        return;
      }

      // Auto-cleanup: remove joined slots whose controller has disconnected.
      for (const slot of slots) {
        if (slot.gamepadIndex >= 0 && !connectedSet.has(slot.gamepadIndex)) {
          removeSessionSlot(slot.gamepadIndex);
        }
      }

      for (const idx of connected) {
        if (joinedSet.has(idx)) {
          // Joined controller presses B → leave session
          if (poller.justPressed(idx, "b")) {
            removeSessionSlot(idx);
          }
        } else {
          // Unjoined controller presses A → join session
          if (poller.justPressed(idx, "a")) {
            addSessionSlot(idx);
          }
        }
      }
    });
  }, [ticker, addSessionSlot, removeSessionSlot]);

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

  // Determine which empty slots have an available (unjoined) controller
  const joinedSlotNums = new Set(pairedSlots.map((s) => s.slot));
  const joinedGamepadSet = new Set(
    pairedSlots.filter((s) => s.gamepadIndex >= 0).map((s) => s.gamepadIndex),
  );
  const unclaimedControllers = connectedIndices.filter((i) => !joinedGamepadSet.has(i));
  const emptySlots = [0, 1, 2, 3].filter((s) => !joinedSlotNums.has(s));
  const controllerAvailableFor = new Set(emptySlots.slice(0, unclaimedControllers.length));

  return (
    <div className="screen home-screen">
      {/* Corner player prompts */}
      {SLOTS.map(({ slot, corner }) => {
        const joined = pairedSlots.find((s) => s.slot === slot);
        const profile = joined ? profiles.find((p) => p.id === joined.profileId) : null;
        const hasController = controllerAvailableFor.has(slot);
        return (
          <div key={slot} className={`player-corner player-corner--${corner}`}>
            <div className="player-corner__label">P{slot + 1}</div>
            {joined ? (
              <div className="player-corner__joined">
                <span
                  className="player-corner__dot"
                  style={{ background: profile?.color ?? "var(--border)" }}
                />
                <span className="player-corner__name">{profile?.name ?? "Guest"}</span>
              </div>
            ) : hasController ? (
              <div className="player-corner__prompt">Press A to join</div>
            ) : (
              <div className="player-corner__no-ctrl">Plug in controller</div>
            )}
          </div>
        );
      })}

      <header className="home-screen__header">
        <img className="home-screen__wordmark" src="/brand/pfp-ff-wordmark.svg" alt="PFP-FF" />
        <nav className="home-screen__nav">
          <span className="controller-chip" title={`${controllers} controller(s) connected`}>
            <img src="/icons/gamepad.svg" alt="" aria-hidden="true" />
            <span>{controllers ? `${controllers} connected` : "No controllers"}</span>
          </span>
          <Btn id="nav-players" onClick={() => setShowPlayers(true)} variant="ghost">
            Players
          </Btn>
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
        <span className="hint">D-pad / stick · A select · A join (unjoined) · B leave (joined)</span>
      </footer>

      {/* Players modal */}
      {showPlayers && (
        <div className="modal-overlay" onClick={() => setShowPlayers(false)}>
          <div className="modal players-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Current Players</h3>
            <div className="players-modal__slots">
              {[0, 1, 2, 3].map((slot) => {
                const joined = pairedSlots.find((s) => s.slot === slot);
                const profile = joined ? profiles.find((p) => p.id === joined.profileId) : null;
                return (
                  <div key={slot} className="players-modal__row">
                    <span className="players-modal__label">P{slot + 1}</span>
                    {joined ? (
                      <>
                        <span
                          className="players-modal__dot"
                          style={{ background: profile?.color ?? "var(--border)" }}
                        />
                        <span className="players-modal__name">{profile?.name ?? "Guest"}</span>
                      </>
                    ) : (
                      <span className="players-modal__empty">— not joined</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="modal__actions">
              <Btn
                id="players-manage"
                onClick={() => {
                  setShowPlayers(false);
                  clearGame();
                  navigate("pairing");
                }}
                variant="ghost"
              >
                Manage Players
              </Btn>
              <Btn id="players-close" onClick={() => setShowPlayers(false)}>
                Done
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
