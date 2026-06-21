import { useEffect, useRef } from "react";
import { PairingLobby } from "@pfp/input";
import { PlayerCard } from "../components/PlayerCard.js";
import { Btn } from "../components/Btn.js";
import { useShell } from "../store.js";
import { useShellTicker } from "../ticker.js";

export function PairingScreen() {
  const { navigate, selectedGame, pairedSlots, setPairedSlots } = useShell();
  const ticker = useShellTicker();
  const lobbyRef = useRef(new PairingLobby({ maxPlayers: selectedGame?.players.max ?? 4 }));

  useEffect(() => {
    const lobby = lobbyRef.current;
    lobby.reset();
    setPairedSlots([]);

    const unsubscribe = lobby.onChange((slots) => setPairedSlots(slots));
    const unregisterTick = ticker.onTick(() => {
      lobby.update(ticker.poller);
    });

    return () => {
      unsubscribe();
      unregisterTick();
    };
  }, [ticker, setPairedSlots]);

  const slots = pairedSlots;
  const minPlayers = selectedGame?.players.min ?? 1;
  const canStart = slots.length >= minPlayers;

  const slotCount = selectedGame?.players.max ?? 4;

  return (
    <div className="screen pairing-screen">
      <header className="pairing-screen__header">
        <h2>Who's Playing?</h2>
        {selectedGame && <p className="pairing-screen__game">{selectedGame.name}</p>}
      </header>

      <div className="pairing-screen__slots">
        {Array.from({ length: slotCount }, (_, i) => {
          const joined = slots.find((s) => s.slot === i);
          return (
            <PlayerCard key={i} slot={i} joined={!!joined} />
          );
        })}
      </div>

      <p className="pairing-screen__hint">
        Press <kbd>A</kbd> to join · Press <kbd>B</kbd> to leave
      </p>

      <div className="pairing-screen__actions">
        <Btn id="pairing-back" onClick={() => navigate("home")} variant="ghost" autoFocus>
          ← Back
        </Btn>
        <Btn
          id="pairing-start"
          onClick={() => canStart && navigate("game")}
          disabled={!canStart}
        >
          Start Game ▶
        </Btn>
      </div>

      {minPlayers > 1 && slots.length < minPlayers && (
        <p className="pairing-screen__need">
          Need at least {minPlayers} players to start
        </p>
      )}
    </div>
  );
}
