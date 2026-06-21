import { useEffect, useRef } from "react";
import { createIframeHost, SDK_VERSION } from "@pfp/sdk";
import { useShell } from "../store.js";
import type { GameHost } from "@pfp/sdk";
import { PLAYER_COLORS } from "../games.js";

export function GameScreen() {
  const { selectedGame, pairedSlots, profiles, setResult, recordMatch, navigate } = useShell();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hostRef = useRef<GameHost | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    const game = selectedGame;
    if (!iframe || !game) return;

    const handleLoad = () => {
      if (!iframe.contentWindow) return;

      const host = createIframeHost(iframe, { sdkRange: game.sdk });
      hostRef.current = host;

      const players = pairedSlots.map((slot) => {
        const profile = profiles.find((p) => p.id === slot.profileId);
        return {
          slot: slot.slot,
          profileId: slot.profileId,
          displayName: profile?.name ?? `P${slot.slot + 1}`,
          color: profile?.color ?? PLAYER_COLORS[slot.slot] ?? "#888",
          gamepadIndex: slot.gamepadIndex,
        };
      });

      host.onReady(() => {
        host.launch({
          sessionId: crypto.randomUUID(),
          sdkVersion: SDK_VERSION,
          players,
          settings: {},
        });
      });

      host.onGameOver((result) => {
        setResult(result);
        void recordMatch(result);
        host.dispose();
        hostRef.current = null;
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
  }, [selectedGame, pairedSlots, profiles, setResult, recordMatch]);

  if (!selectedGame) {
    return (
      <div className="screen game-screen game-screen--error">
        <p>No game selected.</p>
        <button className="btn btn--primary" onClick={() => navigate("home")}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="screen game-screen">
      <iframe
        ref={iframeRef}
        className="game-screen__iframe"
        title={selectedGame.name}
        allow="gamepad"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
