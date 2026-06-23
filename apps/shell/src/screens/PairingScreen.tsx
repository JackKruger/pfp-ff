import { useEffect, useRef, useState } from "react";
import { PairingLobby } from "@pfp/input";
import type { PairingSlot } from "@pfp/input";
import { PlayerCard } from "../components/PlayerCard.js";
import { Btn } from "../components/Btn.js";
import { useShell } from "../store.js";
import { useShellTicker } from "../ticker.js";

// Negative indices are keyboard-only slots and never real Gamepad API indices.
const keyboardGamepadIndex = (slot: number): number => -slot - 1;

export function PairingScreen() {
  const { navigate, selectedGame, pairedSlots, setPairedSlots, profiles } = useShell();
  const ticker = useShellTicker();
  const gamepadSlotsRef = useRef<PairingSlot[]>([]);
  const keyboardSlotsRef = useRef<PairingSlot[]>([]);

  // How many connected controllers haven't joined yet — drives the "no controller" hint.
  const unclaimedCountRef = useRef(0);
  const [unclaimedCount, setUnclaimedCount] = useState(0);

  // Tracks the most recently joined / toggled keyboard slot for profile cycling.
  const lastKeyboardSlotRef = useRef<number>(0);

  // Keep a stable ref to profiles so the tick handler always reads the latest list.
  const profilesRef = useRef(profiles);
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    const maxPlayers = selectedGame?.players.max ?? 4;
    const lobby = new PairingLobby({ maxPlayers });
    gamepadSlotsRef.current = [];
    keyboardSlotsRef.current = [];
    unclaimedCountRef.current = 0;
    setUnclaimedCount(0);

    const publishSlots = () => {
      const gamepadSlots = gamepadSlotsRef.current;
      const keyboardSlots = keyboardSlotsRef.current.filter(
        (slot) => !gamepadSlots.some((gamepadSlot) => gamepadSlot.slot === slot.slot),
      );
      setPairedSlots([...gamepadSlots, ...keyboardSlots].sort((a, b) => a.slot - b.slot));
    };

    // Pre-populate from session state persisted in the store.
    const stored = useShell.getState().pairedSlots;
    const storedGamepadSlots = stored.filter((s) => s.gamepadIndex >= 0 && s.slot < maxPlayers);
    const storedKeyboardSlots = stored.filter((s) => s.gamepadIndex < 0 && s.slot < maxPlayers);

    const joinKeyboardSlot = (slot: number) => {
      if (slot >= maxPlayers) return;
      if (gamepadSlotsRef.current.some((joined) => joined.slot === slot)) return;
      if (keyboardSlotsRef.current.some((joined) => joined.slot === slot)) return;
      keyboardSlotsRef.current = [
        ...keyboardSlotsRef.current,
        { slot, gamepadIndex: keyboardGamepadIndex(slot), profileId: null },
      ];
      publishSlots();
    };

    const removeKeyboardSlot = (slot: number) => {
      const next = keyboardSlotsRef.current.filter((joined) => joined.slot !== slot);
      if (next.length === keyboardSlotsRef.current.length) return;
      keyboardSlotsRef.current = next;
      publishSlots();
    };

    const toggleKeyboardSlot = (slot: number) => {
      if (keyboardSlotsRef.current.some((joined) => joined.slot === slot)) removeKeyboardSlot(slot);
      else joinKeyboardSlot(slot);
      lastKeyboardSlotRef.current = slot;
    };

    const cycleKeyboardProfile = (delta: 1 | -1) => {
      const targetSlot = lastKeyboardSlotRef.current;
      const slot = keyboardSlotsRef.current.find((joined) => joined.slot === targetSlot);
      if (!slot) return;
      const options: (string | null)[] = [null, ...profilesRef.current.map((p) => p.id)];
      const foundIdx = options.indexOf(slot.profileId);
      const currentIdx = foundIdx < 0 ? 0 : foundIdx;
      const nextIdx = (currentIdx + delta + options.length) % options.length;
      keyboardSlotsRef.current = keyboardSlotsRef.current.map((joined) =>
        joined.slot === slot.slot ? { ...joined, profileId: options[nextIdx] } : joined,
      );
      publishSlots();
    };

    const unsubscribe = lobby.onChange((slots) => {
      gamepadSlotsRef.current = slots;
      publishSlots();
    });

    // Restore previous session slots without requiring re-press of A.
    if (storedGamepadSlots.length > 0) {
      lobby.initSlots(storedGamepadSlots);
    }
    if (storedKeyboardSlots.length > 0) {
      keyboardSlotsRef.current = storedKeyboardSlots;
      publishSlots();
    }

    const unregisterTick = ticker.onTick(() => {
      const poller = ticker.poller;

      // 1. Run the pairing lobby for physical gamepads.
      lobby.update(poller);

      // Cache getSlots() — reused for profile cycling and unclaimed count.
      const slots = lobby.getSlots();

      // 2. For each gamepad slot, let that controller cycle through profiles with left/right.
      for (const slot of slots) {
        const idx = slot.gamepadIndex;
        if (!poller.justPressed(idx, "left") && !poller.justPressed(idx, "right")) continue;

        const options: (string | null)[] = [null, ...profilesRef.current.map((p) => p.id)];
        const foundIdx = options.indexOf(slot.profileId);
        const currentIdx = foundIdx < 0 ? 0 : foundIdx;
        const delta = poller.justPressed(idx, "right") ? 1 : -1;
        const nextIdx = (currentIdx + delta + options.length) % options.length;
        lobby.assignProfile(slot.slot, options[nextIdx]);
      }

      // 3. Track how many controllers are available but not yet joined.
      const joined = new Set(slots.map((s) => s.gamepadIndex));
      const physicalUnclaimed = poller.connectedIndices().filter((i) => !joined.has(i)).length;
      const keyboardAvailable = keyboardSlotsRef.current.some((slot) => slot.slot === 0) ? 0 : 1;
      const unclaimed = physicalUnclaimed + keyboardAvailable;
      if (unclaimed !== unclaimedCountRef.current) {
        unclaimedCountRef.current = unclaimed;
        setUnclaimedCount(unclaimed);
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        joinKeyboardSlot(0);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        removeKeyboardSlot(0);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        cycleKeyboardProfile(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        cycleKeyboardProfile(1);
        return;
      }

      const slot = keyboardSlotFromKey(event.code);
      if (slot === null) return;
      event.preventDefault();
      toggleKeyboardSlot(slot);
    };

    window.addEventListener("keydown", handleKeyDown);
    publishSlots();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unsubscribe();
      unregisterTick();
    };
  }, [selectedGame?.players.max, ticker, setPairedSlots]);

  const minPlayers = selectedGame?.players.min ?? 1;
  const canStart = pairedSlots.length >= minPlayers;
  const slotCount = selectedGame?.players.max ?? 4;
  const isManageMode = selectedGame === null;

  // How many unjoinable slots have controllers available for them.
  const joinedCount = pairedSlots.length;
  const availableForNew = Math.min(unclaimedCount, slotCount - joinedCount);

  return (
    <div className="screen pairing-screen">
      <header className="pairing-screen__header">
        <h2>{isManageMode ? "Manage Players" : "Who's Playing?"}</h2>
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
        {isManageMode ? (
          <>
            <kbd>A</kbd> join · <kbd>B</kbd> leave · <kbd>←</kbd><kbd>→</kbd> change profile
          </>
        ) : (
          <>
            <kbd>Enter</kbd> / <kbd>A</kbd> join · <kbd>Esc</kbd> / <kbd>B</kbd> leave · <kbd>←</kbd>
            <kbd>→</kbd> profile · <kbd>1</kbd>-<kbd>4</kbd> keyboard
          </>
        )}
      </p>

      <div className="pairing-screen__actions">
        <Btn id="pairing-back" onClick={() => navigate("home")} variant="ghost" autoFocus>
          ← Back
        </Btn>
        {!isManageMode && (
          <Btn id="pairing-start" onClick={() => canStart && navigate("game")} disabled={!canStart}>
            Start Game ▶
          </Btn>
        )}
      </div>

      {!isManageMode && minPlayers > 1 && pairedSlots.length < minPlayers && (
        <p className="pairing-screen__need">Requires {minPlayers}+ players to start</p>
      )}
    </div>
  );
}

function keyboardSlotFromKey(code: string): number | null {
  if (code === "Digit1") return 0;
  if (code === "Digit2") return 1;
  if (code === "Digit3") return 2;
  if (code === "Digit4") return 3;
  return null;
}
