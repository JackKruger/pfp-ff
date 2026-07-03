import type { GameManifest } from "@pfp/sdk";

const manifest = {
  id: "mydrunner",
  name: "mydrunner",
  version: "0.1.0",
  engine: "web",
  entry: "/games/mydrunner/index.html",
  thumbnail: "/thumbnails/mydrunner.png",
  players: { min: 1, max: 4 },
  sdk: "^1.0.0",
  tags: ["racing", "4x4", "1-4 player"],
  input: { mode: "direct" },
  // No win condition: players just drive. See @pfp/sdk's GameSessionManifest.
  session: { endless: true },
  presentation: {
    category: "racing",
    accent: "#8a6d3b",
    icon: "🚙",
    blurb: "Physics-driven off-road 4x4 — climb the mountain, get unstuck.",
  },
  build: {
    packageName: "@pfp/mydrunner",
    // Not used for a dev-server fan-out (mydrunner's client is a separate
    // repo/workspace with its own dev server on :5173) — kept for manifest
    // shape consistency with other games.
    devPort: 5180,
    built: true,
    // Desktop-only: needs a locally-spawned Node server for authoritative
    // physics. See apps/desktop/src/gameServer.ts.
    desktopServer: {
      command: ["pnpm", "--filter", "@mydrunner/server", "run", "start"],
      cwd: "../mydrunner",
      healthCheckUrl: "http://localhost:2567/health",
      port: 2567,
    },
  },
} satisfies GameManifest;

export default manifest;
