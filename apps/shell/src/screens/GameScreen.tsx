import { useCallback, useEffect, useRef, useState } from "react";
import {
  createControlForwarder,
  schemaFromManifest,
  KeyboardControlSource,
  type ControlForwarder,
} from "@pfp/controls";
import { createIframeHost, SDK_VERSION } from "@pfp/sdk";
import { Btn } from "../components/Btn.js";
import { useShell } from "../store.js";
import { useShellTicker } from "../ticker.js";
import type { GameHost } from "@pfp/sdk";
import { PLAYER_COLORS } from "../games.js";
import { recordMatchBestEffort } from "../gameOver.js";
import { usesShellForwardedInput } from "../shellRules.js";
import {
  isGameScreenDeadEnd,
  transitionGameScreenLifecycle,
  type GameScreenLifecycleAction,
  type GameScreenLifecycleState,
  type GameScreenOverlayItem,
  type GameScreenPhase,
} from "./gameScreenLifecycle.js";

// "done" = game over received; blocks overlay until results navigation fires.
const LOAD_TIMEOUT_MS = 8_000;

export function GameScreen() {
  const { selectedGame, pairedSlots, profiles, setResult, recordMatch, navigate } = useShell();
  const ticker = useShellTicker();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hostRef = useRef<GameHost | null>(null);
  const controlForwarderRef = useRef<ControlForwarder | null>(null);

  const [phase, setPhase] = useState<GameScreenPhase>("loading");
  const [overlayItem, setOverlayItem] = useState<GameScreenOverlayItem>("resume");

  // Stable refs so tick / keyboard handlers always read current values.
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const overlayItemRef = useRef(overlayItem);
  useEffect(() => {
    overlayItemRef.current = overlayItem;
  }, [overlayItem]);

  // A dead-end state is one with nothing playable: no game selected, or load failed.
  // Any input there should escape back to the menu so a controller is never stuck.
  const selectedGameRef = useRef(selectedGame);
  useEffect(() => {
    selectedGameRef.current = selectedGame;
  }, [selectedGame]);
  const lifecycleState = (): GameScreenLifecycleState => ({
    hasSelectedGame: Boolean(selectedGameRef.current),
    phase: phaseRef.current,
    overlayItem: overlayItemRef.current,
  });
  const isDeadEnd = () => isGameScreenDeadEnd(lifecycleState());

  const runLifecycleAction = useCallback(
    (action: GameScreenLifecycleAction) => {
      const transition = transitionGameScreenLifecycle(lifecycleState(), action);
      if (transition.effect === "pause") {
        hostRef.current?.pause();
        controlForwarderRef.current?.setPaused(true);
      }
      if (transition.effect === "resume") {
        hostRef.current?.resume();
        controlForwarderRef.current?.setPaused(false);
      }
      if (transition.effect === "navigateHome") navigate("home");

      if (transition.phase) {
        phaseRef.current = transition.phase;
        setPhase(transition.phase);
      }
      if (transition.overlayItem) {
        overlayItemRef.current = transition.overlayItem;
        setOverlayItem(transition.overlayItem);
      }
    },
    [navigate],
  );

  // Snapshot pairedSlots / profiles at mount so changes don't re-run the iframe effect.
  const pairedSlotsRef = useRef(pairedSlots);
  useEffect(() => {
    pairedSlotsRef.current = pairedSlots;
  }, [pairedSlots]);
  const profilesRef = useRef(profiles);
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  // Timeout: if the game doesn't call ready() within 8 s, show an error.
  useEffect(() => {
    if (phase !== "loading") return;
    const timer = setTimeout(() => setPhase("error"), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // Controller: Start = toggle overlay; in overlay, up/down/A/B navigate.
  useEffect(() => {
    return ticker.onTick(() => {
      const poller = ticker.poller;
      const p = phaseRef.current;
      for (const idx of poller.connectedIndices()) {
        if (isDeadEnd()) {
          if (
            poller.justPressed(idx, "a") ||
            poller.justPressed(idx, "b") ||
            poller.justPressed(idx, "start")
          ) {
            runLifecycleAction("exitDeadEnd");
            return;
          }
          continue;
        }
        if (p === "playing" && poller.justPressed(idx, "start")) {
          runLifecycleAction("requestPause");
          return;
        }
        if (p === "overlay") {
          if (poller.justPressed(idx, "b") || poller.justPressed(idx, "start")) {
            runLifecycleAction("requestResume");
            return;
          }
          if (poller.justPressed(idx, "up") || poller.justPressed(idx, "down")) {
            setOverlayItem((prev) => (prev === "resume" ? "quit" : "resume"));
            return;
          }
          if (poller.justPressed(idx, "a")) {
            runLifecycleAction("confirmOverlay");
            return;
          }
        }
      }
    });
  }, [ticker, navigate, runLifecycleAction]);

  // Keyboard: Escape = toggle overlay; Enter = confirm selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = phaseRef.current;
      if (isDeadEnd()) {
        if (e.key === "Enter" || e.key === "Escape" || e.key === " ") {
          runLifecycleAction("exitDeadEnd");
        }
        return;
      }
      if (e.key === "Escape") {
        if (p === "playing") {
          runLifecycleAction("requestPause");
        } else if (p === "overlay") {
          runLifecycleAction("requestResume");
        }
        return;
      }
      if (p === "overlay") {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          setOverlayItem((prev) => (prev === "resume" ? "quit" : "resume"));
        }
        if (e.key === "Enter") {
          runLifecycleAction("confirmOverlay");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runLifecycleAction]);

  // Wire the SDK host before assigning iframe.src so early ready() is not missed.
  // Deps omit pairedSlots / profiles because those are read via refs.
  useEffect(() => {
    const iframe = iframeRef.current;
    const game = selectedGame;
    if (!iframe || !game) return;

    setPhase("loading");
    setOverlayItem("resume");

    let closed = false;
    let unregisterControlForwarder: (() => void) | null = null;
    const host = createIframeHost(iframe, { sdkRange: game.sdk });
    hostRef.current = host;

    const disposeControlForwarder = () => {
      unregisterControlForwarder?.();
      unregisterControlForwarder = null;
      controlForwarderRef.current?.dispose();
      controlForwarderRef.current = null;
    };

    const closeIframe = () => {
      closed = true;
      disposeControlForwarder();
      host.dispose();
      if (hostRef.current === host) hostRef.current = null;
      iframe.src = "about:blank";
    };

    const returnToShell = () => {
      if (closed) return;
      closeIframe();
      navigate("home");
    };

    host.onReady(() => {
      if (closed) return;
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

      const context = {
        sessionId: crypto.randomUUID(),
        sdkVersion: SDK_VERSION,
        players,
        settings: {},
      };

      host.launch(context);
      if (usesShellForwardedInput(game)) {
        // Keyboard fallback so forwarded games stay playable in dev without a
        // gamepad; it only fills slots whose controller is disconnected.
        const keyboard = new KeyboardControlSource();
        keyboard.attach();
        const forwarder = createControlForwarder({
          host,
          poller: ticker.poller,
          players,
          schema: schemaFromManifest(game.input),
          keyboard,
          clock: () => performance.now(),
        });
        controlForwarderRef.current = forwarder;
        unregisterControlForwarder = ticker.onTick(() => {
          if (phaseRef.current === "playing") forwarder.sendFrame();
        });
      }
      setPhase("playing");
    });

    host.onGameOver((result) => {
      if (closed) return;
      closed = true;
      setPhase("done");
      setResult(result);
      navigate("results");
      void recordMatchBestEffort(result, recordMatch);
      disposeControlForwarder();
      host.dispose();
      if (hostRef.current === host) hostRef.current = null;
    });

    host.onRequestExit(returnToShell);
    host.onError(({ message }) => {
      console.error("Game error:", message);
      returnToShell();
    });
    host.onIncompatible((info) => {
      console.error("Game SDK incompatible:", info);
      returnToShell();
    });
    iframe.src = game.entry;

    return () => {
      if (!closed) host.terminate();
      closed = true;
      disposeControlForwarder();
      host.dispose();
      if (hostRef.current === host) hostRef.current = null;
      iframe.src = "about:blank";
    };
  }, [selectedGame, setResult, recordMatch, navigate, ticker]);

  if (!selectedGame) {
    return (
      <div className="screen game-screen game-screen--no-game">
        <p>No game selected.</p>
        <Btn id="game-no-game-home" onClick={() => navigate("home")} autoFocus>
          Back to Home
        </Btn>
      </div>
    );
  }

  return (
    <div className="screen game-screen">
      {/* Loading indicator */}
      {phase === "loading" && (
        <div className="game-screen__loading">
          <img className="boot-loading__splash" src="/boot-splash.png" alt="" />
          <p>Loading {selectedGame.name}…</p>
        </div>
      )}

      {/* Error state */}
      {phase === "error" && (
        <div className="game-screen__error">
          <p className="game-screen__error-msg">Game failed to load.</p>
          <Btn id="game-error-home" onClick={() => navigate("home")} autoFocus>
            ← Back to Menu
          </Btn>
          <p className="game-screen__error-hint">Ⓐ or Ⓑ to return</p>
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
              onClick={() => runLifecycleAction("requestResume")}
            >
              ▶ Resume
            </button>
            <button
              className={`game-overlay__item${overlayItem === "quit" ? " game-overlay__item--active" : ""}`}
              onClick={() => runLifecycleAction("requestQuitToHome")}
            >
              ✕ Quit to Menu
            </button>
            <p className="game-overlay__hint">↕ navigate · Ⓐ select · Ⓑ resume</p>
          </div>
        </div>
      )}
    </div>
  );
}
