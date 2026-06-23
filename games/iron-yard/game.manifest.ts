import type { GameManifest } from "@pfp/sdk";

const manifest = {
  id: "iron-yard",
  name: "Iron Yard",
  version: "0.1.0",
  engine: "web",
  entry: "/games/iron-yard/index.html",
  players: { min: 1, max: 4 },
  sdk: "^1.0.0",
  tags: ["fighting", "medieval", "physics"],
  thumbnail: "/thumbnails/iron-yard.png",
  statKeys: {
    kills: { label: "Kills", scope: "player" },
    deaths: { label: "Deaths", scope: "player" },
  },
  input: { mode: "direct" },
  presentation: {
    category: "fighting",
    accent: "#f97316",
    icon: "⚔️",
    blurb: "Medieval physics carnage. Forge weapons in the yard and batter your friends.",
  },
  build: {
    packageName: "@pfp/iron-yard",
    devPort: 5177,
    built: true,
  },
} satisfies GameManifest;

export default manifest;
