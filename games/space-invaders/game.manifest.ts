import type { GameManifest } from "@pfp/sdk";

const manifest = {
  id: "space-invaders",
  name: "Space Invaders",
  version: "0.1.0",
  engine: "web",
  entry: "/games/space-invaders/index.html",
  players: { min: 1, max: 4 },
  sdk: "^1.0.0",
  tags: ["classic", "co-op", "arcade"],
  thumbnail: "/thumbnails/space-invaders.png",
  statKeys: {
    score: { label: "Score", scope: "player" },
    aliensKilled: { label: "Aliens Killed", scope: "player" },
    shotsFired: { label: "Shots Fired", scope: "player" },
    accuracy: { label: "Accuracy", scope: "player" },
    deaths: { label: "Deaths", scope: "player" },
    waveReached: { label: "Wave Reached", scope: "match" },
    totalAliensKilled: { label: "Total Aliens Killed", scope: "match" },
    durationMs: { label: "Duration", scope: "match" },
    survived: { label: "Survived", scope: "match" },
  },
  input: {
    // Hybrid: the shell forwards normalized control frames, but the game keeps
    // its direct gamepad/keyboard reader as a fallback for standalone dev.
    mode: "hybrid",
    actions: {
      // -1 = left, +1 = right. Stick is deadzoned shell-side; d-pad snaps to ±1.
      move: [{ source: "leftStickX", deadzone: 0.18 }, { source: "dpadX" }],
      shoot: [{ source: "a" }],
      start: [{ source: "start" }],
    },
  },
  presentation: {
    category: "classic",
    accent: "#22c55e",
    icon: "👾",
    blurb: "Hold the line together. Co-op waves of descending invaders, four cannons strong.",
  },
  build: {
    packageName: "@pfp/space-invaders",
    devPort: 5176,
    built: true,
  },
} satisfies GameManifest;

export default manifest;
