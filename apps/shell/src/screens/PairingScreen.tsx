import { useEffect, useRef, useState } from "react";
import { PairingLobby } from "@pfp/input";
import { PlayerCard } from "../components/PlayerCard.js";
import { Btn } from "../components/Btn.js";
import { useShell } from "../store.js";
import { useShellTicker } from "../ticker.js";

export function PairingScreen() {
  const { navigate, selectedGame, pairedSlots, setPairedSlots, profiles } = useShell();
  const ticker = useShellTicker();
  const lobbyRef = useRef(new PairingLobby({ maxPlayers: selectedGame?.players.max ?? 4 }));

  // How many connected controllers haven't joined yet — drives the "no controller" hint.
  const unclaimedCountRef = useRef(0);
  const [unclaimedCount, setUnclaimedCount] = useState(0);

  // Keep a stable ref to profiles so the tick handler always reads the latest list.
  const profilesRef = useRef(profiles);
  useEffect(() => { profilesRef.current = profiles; }, [profiles]);

  useEffect(() => {
    const lobby = lobbyRef.current;
    lobby.reset();
    setPairedSlots([]);

    const unsubscribe = lobby.onChange((slots) => setPairedSlots(slots));

    const unregisterTick = ticker.onTick(() => {
      const poller = ticker.poller;

      // 1. Run the pairing lobby (join / leave / disconnect).
      lobby.update(poller);

      // Cache getSlots() — reused for profile cycling and unclaimed count.
      const slots = lobby.getSlots();

      // 2. For each joined slot, let that controller cycle through profiles with ←/→.
      for (const slot of slots) {
        const idx = slot.gamepadIndex;
        if (!poller.justPressed(idx, "left") && !poller.justPressed(idx, "right")) continue;

        const options: (string | null)[] = [null, ...profilesRef.current.map((p) => p.id)];
        const foundIdx = options.indexOf(slot.profileId);
        const currentIdx = foundIdx < 0 ? 0 : foundIdx; // -1 when profile was deleted → snap to Guest
        const delta = poller.justPressed(idx, "right") ? 1 : -1;
        const nextIdx = (currentIdx + delta + options.length) % options.length;
        lobby.assignProfile(slot.slot, options[nextIdx]);
      }

      // 3. Track how many controllers are available but not yet joined.
      const joined = new Set(slots.map((s) => s.gamepadIndex));
      const unclaimed = poller.connectedIndices().filter((i) => !joined.has(i)).length;
      if (unclaimed !== unclaimedCountRef.current) {
        unclaimedCountRef.current = unclaimed;
        setUnclaimedCount(unclaimed);
      }
    });

    return () => {
      unsubscribe();
      unregisterTick();
    };
  }, [ticker, setPairedSlots]);

  const minPlayers = selectedGame?.players.min ?? 1;
  const canStart = pairedSlots.length >= minPlayers;
  const slotCount = selectedGame?.players.max ?? 4;

  // How many unjoinable slots have controllers available for them.
  const joinedCount = pairedSlots.length;
  const availableForNew = Math.min(unclaimedCount, slotCount - joinedCount);

  return (
    <div className="screen pairing-screen">
      <header className="pairing-screen__header">
        <h2>Who's Playing?</h2>
        {selectedGame && <p className="pairing-screen__game">{selectedGame.name}</p>}
      </header>

      <div className="pairing-screen__slots">
        {Array.from({ length: slotCount }, (_, i) => {
          const joined = pairedSlots.find((s) => s.slot === i);
          if (joined) {
            const profile = profiles.find((p) => p.id === joined.profileId);
            return (
              <PlayerCard
                key={i}
                slot={i}
                joined
                profileName={profile?.name ?? "Guest"}
                profileColor={profile?.color}
              />
            );
          }
          // Show "Press A" only if an unclaimed controller could fill this slot.
          // Count empty slots before i: total slots before i minus the joined ones.
          const emptyBefore = i - pairedSlots.filter((s) => s.slot < i).length;
          const hasController = emptyBefore < availableForNew;
          return <PlayerCard key={i} slot={i} joined={false} controllerAvailable={hasController} />;
        })}
      </div>

      <p className="pairing-screen__hint">
        Press <kbd>A</kbd> to join · <kbd>B</kbd> to leave · <kbd>←</kbd><kbd>→</kbd> to pick profile
      </p>

      <div className="pairing-screen__actions">
        <Btn id="pairing-back" onClick={() => navigate("home")} variant="ghost" autoFocus>
          ← Back
        </Btn>
        <Btn id="pairing-start" onClick={() => canStart && navigate("game")} disabled={!canStart}>
          Start Game ▶
        </Btn>
      </div>

      {minPlayers > 1 && pairedSlots.length < minPlayers && (
        <p className="pairing-screen__need">Need at least {minPlayers} players to start</p>
      )}
    </div>
  );
}
