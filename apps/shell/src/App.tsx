import { useEffect, useMemo } from "react";
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

  // B button = back
  useEffect(() => {
    focus.onBack = () => {
      if (screen === "home") return;
      navigate("home");
    };
  }, [focus, screen, navigate]);

  // D-pad / A / B navigation; skip during pairing (lobby owns A/B) and in-game.
  useEffect(() => {
    if (screen === "game" || screen === "pairing") return;

    return ticker.onTick(() => {
      const poller = ticker.poller;
      for (const idx of poller.connectedIndices()) {
        if (poller.justPressed(idx, "up")) {
          focus.navigate("up");
          return;
        }
        if (poller.justPressed(idx, "down")) {
          focus.navigate("down");
          return;
        }
        if (poller.justPressed(idx, "left")) {
          focus.navigate("left");
          return;
        }
        if (poller.justPressed(idx, "right")) {
          focus.navigate("right");
          return;
        }
        if (poller.justPressed(idx, "a")) {
          focus.select();
          return;
        }
        if (poller.justPressed(idx, "b")) {
          focus.back();
          return;
        }
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
      // Let text fields (e.g. the profile-name input) handle their own keys —
      // arrows move the caret, Enter/Escape are handled locally by the field.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

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
