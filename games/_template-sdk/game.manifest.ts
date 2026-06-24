import type { GameManifest } from "@pfp/sdk";

const manifest = {
  id: "__GAME_ID__",
  name: "__GAME_NAME__",
  version: "0.1.0",
  engine: "web",
  entry: "/games/__GAME_ID__/index.html",
  players: { min: 1, max: 4 },
  sdk: "^1.0.0",
  tags: ["template"],
  input: { mode: "direct" },
  presentation: {
    category: "party",
    accent: "#4f9dff",
    icon: "🎮",
    blurb: "Replace this with a one-line game pitch.",
  },
  build: {
    packageName: "__PACKAGE_NAME__",
    devPort: __DEV_PORT__,
    built: true,
  },
} satisfies GameManifest;

export default manifest;
