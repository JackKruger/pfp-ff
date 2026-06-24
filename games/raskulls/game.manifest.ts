import type { GameManifest } from "@pfp/sdk";

const manifest = {
  id: "raskulls",
  name: "Raskulls",
  version: "0.0.0",
  engine: "web",
  entry: "/games/raskulls/index.html",
  players: { min: 1, max: 4 },
  sdk: "^1.0.0",
  tags: ["racing", "arena"],
  thumbnail: "/thumbnails/raskulls.png",
  statKeys: {
    wins: { label: "Wins", scope: "player" },
    finishMs: { label: "Finish Time", scope: "player" },
    blocksBroken: { label: "Blocks Broken", scope: "player" },
    gems: { label: "Gems", scope: "player" },
    eliminations: { label: "Eliminations", scope: "player" },
    deaths: { label: "Deaths", scope: "player" },
    mode: { label: "Mode", scope: "match" },
    durationMs: { label: "Duration", scope: "match" },
  },
  input: { mode: "direct" },
  settings: {
    fields: [
      {
        id: "raceBots",
        label: "Fill race with bots",
        type: "boolean",
        default: true,
      },
    ],
  },
  presentation: {
    category: "racing",
    accent: "#f59e0b",
    icon: "🏁",
    blurb: "Smash, dash and gem-grab your way to the finish in a chaotic block-breaking race.",
    heroArt: "/hero/raskulls.png",
    featured: true,
  },
  build: {
    packageName: "@pfp/raskulls",
    devPort: 5174,
    built: true,
  },
} satisfies GameManifest;

export default manifest;
