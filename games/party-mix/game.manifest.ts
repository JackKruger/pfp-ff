import type { GameManifest } from "@pfp/sdk";

const manifest = {
  id: "party-mix",
  name: "Party Mix",
  version: "0.1.0",
  engine: "web",
  entry: "/games/party-mix/index.html",
  thumbnail: "/thumbnails/party-mix.png",
  players: { min: 2, max: 4 },
  sdk: "^1.0.0",
  tags: ["party", "mini-games"],
  statKeys: {
    stars: { label: "Stars", scope: "player" },
    coins: { label: "Coins", scope: "player" },
    minigamesWon: { label: "Minigames Won", scope: "player" },
    rounds: { label: "Rounds", scope: "match" },
    durationMs: { label: "Duration", scope: "match" },
  },
  input: { mode: "direct" },
  presentation: {
    category: "party",
    accent: "#c084fc",
    icon: "🎉",
    blurb: "A whirlwind of bite-sized minigames. Collect stars across the board to win the night.",
    disabled: true,
  },
  build: {
    packageName: "@pfp/party-mix",
    devPort: 5178,
    built: false,
  },
} satisfies GameManifest;

export default manifest;
