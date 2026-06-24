import type { GameManifest } from "@pfp/sdk";

const manifest = {
  id: "pong",
  name: "Pong",
  version: "0.1.0",
  engine: "web",
  entry: "/games/pong/index.html",
  thumbnail: "/thumbnails/pong.png",
  players: { min: 1, max: 2 },
  sdk: "^1.0.0",
  tags: ["classic", "1-2 player"],
  statKeys: {
    score: { label: "Score", scope: "player" },
    durationMs: { label: "Duration", scope: "match" },
  },
  input: {
    // Forwarded in shell; the game keeps its direct reader as a standalone-dev
    // fallback when no shell control frame has arrived.
    mode: "forwarded",
    actions: {
      // -1 = up, +1 = down. Stick is deadzoned shell-side; d-pad snaps to ±1.
      paddle: [{ source: "leftStickY", deadzone: 0.18 }, { source: "dpadY" }],
      start: [{ source: "start" }],
      serve: [{ source: "a" }],
      back: [{ source: "b" }],
    },
  },
  presentation: {
    category: "classic",
    accent: "#4f9dff",
    icon: "🏓",
    blurb: "The original duel. First to outlast your rival across the neon table.",
  },
  build: {
    packageName: "@pfp/pong",
    devPort: 5175,
    built: true,
  },
} satisfies GameManifest;

export default manifest;
