import { useEffect, useMemo, useRef } from "react";
import { FocusProvider, useFocusManager, type FocusDirection } from "@pfp/ui";
import { ShellTicker, TickerCtx } from "./ticker.js";
import { useShell } from "./store.js";
import { HomeScreen } from "./screens/HomeScreen.js";
import { PairingScreen } from "./screens/PairingScreen.js";
import { ProfilesScreen } from "./screens/ProfilesScreen.js";
import { GameScreen } from "./screens/GameScreen.js";
import { ResultsScreen } from "./screens/ResultsScreen.js";
import { StatsScreen } from "./screens/StatsScreen.js";

function ScreenRouter() {
  const { screen } = useShell();
  switch (screen) {
    case "home":
      return <HomeScreen />;
    case "profiles":
      return <ProfilesScreen />;
    case "pairing":
      return <PairingScreen />;
    case "game":
      return <GameScreen />;
    case "results":
      return <ResultsScreen />;
    case "stats":
      return <StatsScreen />;
  }
}

/** Reads controller input each tick and drives spatial focus navigation. */
function GlobalInput({ ticker }: { ticker: ShellTicker }) {
  const focus = useFocusManager();
  const { screen, navigate } = useShell();
  // Tracks previous analog stick position per gamepad index for edge detection.
  const axisRef = useRef<Record<number, { x: number; y: number }>>({});

  // B button = back
  useEffect(() => {
    focus.onBack = () => {
      if (screen === "home") return;
      navigate("home");
    };
  }, [focus, screen, navigate]);

  // D-pad / left-stick / A / B navigation; skip during pairing (lobby owns A/B) and in-game.
  // Only joined controllers drive the focus; falls back to all connected if none are joined.
  useEffect(() => {
    if (screen === "game" || screen === "pairing") return;

    return ticker.onTick(() => {
      const poller = ticker.poller;

      // Determine which controllers should drive the menu.
      const { pairedSlots } = useShell.getState();
      const joinedIndices = pairedSlots
        .filter((s) => s.gamepadIndex >= 0)
        .map((s) => s.gamepadIndex);
      const activeIndices =
        joinedIndices.length > 0 ? joinedIndices : poller.connectedIndices();

      // Pass 1: Update analog axis refs for all active controllers (always needed
      // for edge detection even when no direction fires this frame).
      const stickDirs: Record<number, FocusDirection | null> = {};
      for (const idx of activeIndices) {
        const state = poller.getState(idx);
        if (!state) { stickDirs[idx] = null; continue; }
        const prev = axisRef.current[idx] ?? { x: 0, y: 0 };
        const x = state.axes.lx;
        const y = state.axes.ly;
        axisRef.current[idx] = { x, y };
        const THRESHOLD = 0.5;
        const wasH = Math.abs(prev.x) >= THRESHOLD;
        const wasV = Math.abs(prev.y) >= THRESHOLD;
        const isH = Math.abs(x) >= THRESHOLD;
        const isV = Math.abs(y) >= THRESHOLD;
        if (!wasV && isV) { stickDirs[idx] = y < 0 ? "up" : "down"; }
        else if (!wasH && isH) { stickDirs[idx] = x < 0 ? "left" : "right"; }
        else { stickDirs[idx] = null; }
      }

      // Pass 2: First controller with an action wins (early return).
      for (const idx of activeIndices) {
        if (poller.justPressed(idx, "up")) { focus.navigate("up"); return; }
        if (poller.justPressed(idx, "down")) { focus.navigate("down"); return; }
        if (poller.justPressed(idx, "left")) { focus.navigate("left"); return; }
        if (poller.justPressed(idx, "right")) { focus.navigate("right"); return; }
        const stickDir = stickDirs[idx];
        if (stickDir) { focus.navigate(stickDir); return; }
        if (poller.justPressed(idx, "a")) { focus.select(); return; }
        if (poller.justPressed(idx, "b")) { focus.back(); return; }
      }
    });
  }, [ticker, focus, screen]);

  // Keyboard fallback (arrow keys + Enter + Escape) for desktop/dev.
  // Pairing and game screens own their own keyboard input.
  useEffect(() => {
    if (screen === "game" || screen === "pairing") return;

    const KEY_TO_DIR: Record<string, FocusDirection> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };

    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIR[e.key];
      if (dir) {
        e.preventDefault();
        focus.navigate(dir);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        focus.select();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        focus.back();
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, screen]);

  return null;
}

export function App() {
  const ticker = useMemo(() => new ShellTicker(), []);
  const { loadData, dataReady } = useShell();

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    ticker.start();
    return () => ticker.stop();
  }, [ticker]);

  if (!dataReady) {
    return (
      <div className="boot-loading">
        <img className="boot-loading__splash" src="/boot-splash.png" alt="" />
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <TickerCtx.Provider value={ticker}>
      <FocusProvider>
        <GlobalInput ticker={ticker} />
        <ScreenRouter />
      </FocusProvider>
    </TickerCtx.Provider>
  );
}
