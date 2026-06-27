import type { GameManifest } from "@pfp/sdk";

const manifest = {
  id: "fowl-play",
  name: "Fowl Play",
  version: "0.1.0",
  engine: "web",
  entry: "/games/fowl-play/index.html",
  thumbnail: "/thumbnails/fowl-play.png",
  players: { min: 2, max: 4 },
  sdk: "^1.0.0",
  tags: ["party", "2-4 player", "platformer"],
  statKeys: {
    finalScore: { label: "Score", scope: "player" },
    roundsWon: { label: "Rounds won", scope: "player" },
    finishes: { label: "Finishes", scope: "player" },
    deaths: { label: "Deaths", scope: "player" },
    coinsCollected: { label: "Coins", scope: "player" },
    diamondsCollected: { label: "Diamonds", scope: "player" },
    killsCaused: { label: "Trap kills", scope: "player" },
    loneSurvivor: { label: "Lone survivor rounds", scope: "player" },
    trapsPlaced: { label: "Pieces placed", scope: "player" },
    selfKills: { label: "Self kills", scope: "player" },
    roundsPlayed: { label: "Rounds played", scope: "match" },
    matchDurationMs: { label: "Duration", scope: "match" },
    winningScore: { label: "Winning score", scope: "match" },
  },
  input: {
    // Direct mode: the game polls navigator.getGamepads() itself using the
    // gamepadIndex per slot from LaunchContext. Two control schemes are used —
    // placement (cursor + piece select) and race (platformer movement).
    mode: "direct",
  },
  settings: {
    fields: [
      {
        id: "winScore",
        label: "Score to win",
        type: "choice",
        options: [
          { value: "5", label: "Quick (5 pts)" },
          { value: "9", label: "Standard (9 pts)" },
          { value: "15", label: "Marathon (15 pts)" },
        ],
        default: "9",
      },
      {
        id: "handSize",
        label: "Pieces in hand",
        type: "number",
        min: 3,
        max: 7,
        default: 5,
      },
    ],
  },
  presentation: {
    category: "party",
    accent: "#f59e0b",
    icon: "🐔",
    blurb: "Lay your traps, then race your friends. Last chicken running wins.",
    // In development — surfaced as "Coming Soon" until v1 ships. Flip false
    // once the game is fully playable and added to BUILT_GAME_IDS.
    disabled: true,
  },
  build: {
    packageName: "@pfp/fowl-play",
    devPort: 5179,
    built: false,
  },
} satisfies GameManifest;

export default manifest;
