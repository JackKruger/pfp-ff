import { useCallback, useEffect, useRef, useState } from "react";
import {
  createControlForwarder,
  schemaFromManifest,
  KeyboardControlSource,
  type ControlForwarder,
} from "@pfp/controls";
import { createIframeHost, SDK_VERSION, validateGameResult } from "@pfp/sdk";
import { Btn } from "../components/Btn.js";
import { useShell } from "../store.js";
import { useShellTicker } from "../ticker.js";
import type { GameHost } from "@pfp/sdk";
import { PLAYER_COLORS } from "../games.js";
import { validateSettingsFor } from "../gameSettings.js";
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
// Games with build.desktopServer wait on a locally-spawned server's health
// check (apps/desktop's HEALTH_CHECK_TIMEOUT_MS is 10s) before they can even
// call ready() — give them enough room that a healthy-but-slow server doesn't
// trip the generic load timeout.
const DESKTOP_SERVER_LOAD_TIMEOUT_MS = 16_000;

export function GameScreen() {
  const {
    selectedGame,
    selectedGameSettings,
    pairedSlots,
    profiles,
    setResult,
    recordMatch,
    navigate,
  } = useShell();
  const ticker = useShellTicker();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hostRef = useRef<GameHost | null>(null);
  const controlForwarderRef = useRef<ControlForwarder | null>(null);
  // Bridges the load-timeout effect (below) to the current mount's teardown
  // path, so a timed-out load also stops any desktop server it started.
  const closeIframeRef = useRef<(() => void) | null>(null);

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

  // Timeout: if the game doesn't call ready() in time, show an error and tear
  // the iframe (and any desktop server it started) down via closeIframeRef —
  // otherwise a timed-out load left a server process running with nothing to
  // ever stop it.
  useEffect(() => {
    if (phase !== "loading") return;
    const timeoutMs = selectedGame?.build?.desktopServer
      ? DESKTOP_SERVER_LOAD_TIMEOUT_MS
      : LOAD_TIMEOUT_MS;
    const timer = setTimeout(() => {
      setPhase("error");
      closeIframeRef.current?.();
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [phase, selectedGame]);

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
    let launched = false;
    // Set when `launch` is sent; the game's GameResult must echo it back.
    let launchedSessionId: string | null = null;
    let unregisterControlForwarder: (() => void) | null = null;
    const desktopServer = game.build?.desktopServer;
    // Restrict postMessage delivery to the game's own origin so the launch
    // context is never handed to whatever the iframe may have navigated to.
    // Opaque origins ("null", e.g. the packaged Electron shell served from
    // file://) are not legal postMessage targets, so fall back to "*" there.
    const entryOrigin = new URL(game.entry, window.location.href).origin;
    const host = createIframeHost(iframe, {
      sdkRange: game.sdk,
      targetOrigin: entryOrigin === "null" || entryOrigin === "" ? "*" : entryOrigin,
    });
    hostRef.current = host;

    // Unconditional (not gated by "did the start call resolve yet") so a
    // teardown that races ahead of startGameServer's in-flight IPC call still
    // stops the server once it exists: stopGameServer() is a documented
    // no-op when nothing is running (apps/desktop/src/gameServer.ts), so
    // calling it defensively costs nothing.
    const stopDesktopServer = () => {
      if (desktopServer) void window.pfpDesktop?.stopGameServer();
    };

    // Kicked off in parallel with the iframe load so it's ready (or close to
    // it) by the time the game reports `ready`. Resolves to undefined for
    // games without build.desktopServer, or in plain-browser mode.
    const desktopServerUrl: Promise<string | undefined> = (async () => {
      if (!desktopServer || !window.pfpDesktop) return undefined;
      const { url } = await window.pfpDesktop.startGameServer(desktopServer);
      if (closed) {
        // Teardown already ran (and found nothing to stop, since the child
        // didn't exist yet) before this resolved — stop the now-orphaned
        // server here instead.
        stopDesktopServer();
        return undefined;
      }
      return url;
    })().catch((error) => {
      console.error("Failed to start desktop game server:", error);
      return undefined;
    });

    const disposeControlForwarder = () => {
      unregisterControlForwarder?.();
      unregisterControlForwarder = null;
      controlForwarderRef.current?.dispose();
      controlForwarderRef.current = null;
    };

    const closeIframe = () => {
      if (closed) return;
      closed = true;
      disposeControlForwarder();
      host.dispose();
      if (hostRef.current === host) hostRef.current = null;
      iframe.src = "about:blank";
      stopDesktopServer();
    };
    closeIframeRef.current = closeIframe;

    const returnToShell = () => {
      if (closed) return;
      closeIframe();
      navigate("home");
    };

    host.onReady(() => {
      if (closed) return;
      // A second `ready` (game reloaded itself, or a misbehaving client) must
      // not launch a second session or wire a second control forwarder.
      if (launched) {
        console.warn(`${game.id} sent ready again after launch; ignoring.`);
        return;
      }
      launched = true;
      const settings = validateSettingsFor(game, selectedGameSettings);
      if (!settings.ok) {
        console.error("Invalid game settings:", settings.errors);
        setPhase("error");
        closeIframe();
        return;
      }

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

      void desktopServerUrl.then((serverUrl) => {
        if (closed) return;
        if (desktopServer && !serverUrl) {
          console.error("Desktop game server failed to start; aborting launch.");
          setPhase("error");
          closeIframe();
          return;
        }

        const context = {
          sessionId: crypto.randomUUID(),
          sdkVersion: SDK_VERSION,
          players,
          settings: serverUrl ? { ...settings.value, serverUrl } : settings.value,
        };
        launchedSessionId = context.sessionId;

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
    });

    host.onGameOver((result) => {
      if (closed) return;
      // Match records are immutable once stored, so reject a result whose
      // structure is malformed or that isn't for the game/session we launched
      // (e.g. a stale report after a self-reload) before it can be recorded.
      const resultErrors = validateGameResult(result, {
        gameId: game.id,
        ...(launchedSessionId !== null ? { sessionId: launchedSessionId } : {}),
      });
      if (resultErrors.length > 0) {
        console.error(`${game.id} sent an invalid GameResult; discarding it:`, resultErrors);
        returnToShell();
        return;
      }
      closed = true;
      // session.endless games have no ranking to show or record — enforced
      // here (not just left to the game's own choice of requestExit vs
      // gameOver) so a misbehaving/updated game can't silently start
      // recording matches its manifest says it never will.
      if (game.session?.endless) {
        console.warn(
          `${game.id} declares session.endless but called gameOver(); ignoring its GameResult.`,
        );
        navigate("home");
      } else {
        setPhase("done");
        setResult(result);
        navigate("results");
        void recordMatchBestEffort(result, recordMatch);
      }
      disposeControlForwarder();
      host.dispose();
      if (hostRef.current === host) hostRef.current = null;
      stopDesktopServer();
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
      closeIframeRef.current = null;
      disposeControlForwarder();
      host.dispose();
      if (hostRef.current === host) hostRef.current = null;
      iframe.src = "about:blank";
      stopDesktopServer();
    };
  }, [selectedGame, selectedGameSettings, setResult, recordMatch, navigate, ticker]);

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
