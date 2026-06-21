import { useEffect, useRef, useState } from "react";
import { createIframeHost, SDK_VERSION } from "@pfp/sdk";
import { useShell } from "../store.js";
import { useShellTicker } from "../ticker.js";
import type { GameHost } from "@pfp/sdk";
import { PLAYER_COLORS } from "../games.js";

// "done" = game over received; blocks overlay until results navigation fires.
type Phase = "loading" | "playing" | "overlay" | "error" | "done";
type OverlayItem = "resume" | "quit";

const LOAD_TIMEOUT_MS = 8_000;

export function GameScreen() {
  const { selectedGame, pairedSlots, profiles, setResult, recordMatch, navigate } = useShell();
  const ticker = useShellTicker();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hostRef = useRef<GameHost | null>(null);

  const [phase, setPhase] = useState<Phase>("loading");
  const [overlayItem, setOverlayItem] = useState<OverlayItem>("resume");

  // Stable refs so tick / keyboard handlers always read current values.
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const overlayItemRef = useRef(overlayItem);
  useEffect(() => { overlayItemRef.current = overlayItem; }, [overlayItem]);

  // Snapshot pairedSlots / profiles at mount so changes don't re-run the iframe effect.
  const pairedSlotsRef = useRef(pairedSlots);
  useEffect(() => { pairedSlotsRef.current = pairedSlots; }, [pairedSlots]);
  const profilesRef = useRef(profiles);
  useEffect(() => { profilesRef.current = profiles; }, [profiles]);

  // Timeout: if the game doesn't call ready() within 8 s, show an error.
  useEffect(() => {
    if (phase !== "loading") return;
    const timer = setTimeout(() => setPhase("error"), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // Controller: Start = toggle overlay; in overlay, ↑↓/A/B navigate.
  useEffect(() => {
    return ticker.onTick(() => {
      const poller = ticker.poller;
      const p = phaseRef.current;
      for (const idx of poller.connectedIndices()) {
        if (p === "playing" && poller.justPressed(idx, "start")) {
          setPhase("overlay");
          setOverlayItem("resume");
          return;
        }
        if (p === "overlay") {
          if (poller.justPressed(idx, "b") || poller.justPressed(idx, "start")) {
            setPhase("playing");
            return;
          }
          if (poller.justPressed(idx, "up") || poller.justPressed(idx, "down")) {
            setOverlayItem((prev) => (prev === "resume" ? "quit" : "resume"));
            return;
          }
          if (poller.justPressed(idx, "a")) {
            if (overlayItemRef.current === "quit") navigate("home");
            else setPhase("playing");
            return;
          }
        }
      }
    });
  }, [ticker, navigate]);

  // Keyboard: Escape = toggle overlay; Enter = confirm selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = phaseRef.current;
      if (e.key === "Escape") {
        if (p === "playing") { setPhase("overlay"); setOverlayItem("resume"); }
        else if (p === "overlay") setPhase("playing");
        return;
      }
      if (p === "overlay") {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          setOverlayItem((prev) => (prev === "resume" ? "quit" : "resume"));
        }
        if (e.key === "Enter") {
          if (overlayItemRef.current === "quit") navigate("home");
          else setPhase("playing");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // Wire the SDK host when the iframe loads.
  // Deps omit pairedSlots / profiles — those are read via refs so profile edits
  // or lobby state changes don't tear down an in-progress game.
  useEffect(() => {
    const iframe = iframeRef.current;
    const game = selectedGame;
    if (!iframe || !game) return;

    const handleLoad = () => {
      if (!iframe.contentWindow) return;

      const host = createIframeHost(iframe, { sdkRange: game.sdk });
      hostRef.current = host;

      const players = pairedSlotsRef.current.map((slot) => {
        const profile = profilesRef.current.find((p) => p.id === slot.profileId);
        return {
          slot: slot.slot,
          profileId: slot.profileId,
          displayName: profile?.name ?? `P${slot.slot + 1}`,
          color: profile?.color ?? PLAYER_COLORS[slot.slot] ?? "#888",
          gamepadIndex: slot.gamepadIndex,
        };
      });

      host.onReady(() => {
        // launch first — if it throws, phase stays "loading" and the error is surfaced.
        host.launch({ sessionId: crypto.randomUUID(), sdkVersion: SDK_VERSION, players, settings: {} });
        setPhase("playing");
      });

      host.onGameOver((result) => {
        setPhase("done"); // block overlay; results navigation follows async
        setResult(result);
        recordMatch(result).catch(console.error);
        host.dispose();
        hostRef.current = null;
      });

      host.onError(({ message }) => {
        console.error("Game error:", message);
        setPhase("error");
      });
    };

    iframe.addEventListener("load", handleLoad);
    iframe.src = game.entry;

    return () => {
      iframe.removeEventListener("load", handleLoad);
      hostRef.current?.dispose();
      hostRef.current = null;
      iframe.src = "about:blank";
    };
  }, [selectedGame, setResult, recordMatch]);

  if (!selectedGame) {
    return (
      <div className="screen game-screen game-screen--no-game">
        <p>No game selected.</p>
        <button className="btn btn--primary" onClick={() => navigate("home")}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="screen game-screen">
      {/* Loading indicator */}
      {phase === "loading" && (
        <div className="game-screen__loading">
          <div className="boot-loading__spinner" />
          <p>Loading {selectedGame.name}…</p>
        </div>
      )}

      {/* Error state */}
      {phase === "error" && (
        <div className="game-screen__error">
          <p className="game-screen__error-msg">Game failed to load.</p>
          <button className="btn btn--primary" onClick={() => navigate("home")}>
            ← Back to Menu
          </button>
        </div>
      )}

      <iframe
        ref={iframeRef}
        className="game-screen__iframe"
        title={selectedGame.name}
        allow="gamepad"
        sandbox="allow-scripts allow-same-origin"
        // Hide while loading so the blank iframe doesn't flash
        style={{ visibility: phase === "loading" ? "hidden" : "visible" }}
      />

      {/* Quit overlay */}
      {phase === "overlay" && (
        <div className="game-overlay">
          <div className="game-overlay__box">
            <h2 className="game-overlay__title">Paused</h2>
            <button
              className={`game-overlay__item${overlayItem === "resume" ? " game-overlay__item--active" : ""}`}
              onClick={() => setPhase("playing")}
            >
              ▶ Resume
            </button>
            <button
              className={`game-overlay__item${overlayItem === "quit" ? " game-overlay__item--active" : ""}`}
              onClick={() => navigate("home")}
            >
              ✕ Quit to Menu
            </button>
            <p className="game-overlay__hint">↑↓ navigate · A select · B / Esc resume</p>
          </div>
        </div>
      )}
    </div>
  );
}
