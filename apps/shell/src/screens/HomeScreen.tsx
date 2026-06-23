import { useEffect, useRef, useState } from "react";
import { GameCard } from "../components/GameCard.js";
import { Btn } from "../components/Btn.js";
import { GAMES } from "../games.js";
import type { GameEntry } from "../games.js";
import { useShell } from "../store.js";
import { useShellTicker } from "../ticker.js";

const SLOTS = [
  { slot: 0, corner: "tl" },
  { slot: 1, corner: "tr" },
  { slot: 2, corner: "bl" },
  { slot: 3, corner: "br" },
] as const;

export function HomeScreen() {
  const { navigate, selectGame, clearGame, pairedSlots, profiles, addSessionSlot, removeSessionSlot } =
    useShell();
  const ticker = useShellTicker();
  const [connectedIndices, setConnectedIndices] = useState<number[]>([]);
  const [showPlayers, setShowPlayers] = useState(false);

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
          <Btn id="nav-players" onClick={() => setShowPlayers(true)} variant="ghost">
            Players
          </Btn>
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
