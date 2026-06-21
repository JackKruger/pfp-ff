import type { GameManifest } from "@pfp/sdk";

const raskullsEntry = import.meta.env.DEV ? "http://localhost:5174/" : "/games/raskulls/index.html";

/** Games known to the shell. Phase 5 adds Pong for real; these are placeholders. */
export const GAMES: GameManifest[] = [
  {
    id: "raskulls",
    name: "Raskulls",
    version: "0.0.0",
    engine: "web",
    entry: raskullsEntry,
    players: { min: 2, max: 4 },
    sdk: "^1.0.0",
    tags: ["racing", "arena"],
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
  },
  {
    id: "pong",
    name: "Pong",
    version: "0.0.0",
    engine: "web",
    entry: "/games/pong/index.html",
    thumbnail: "/thumbnails/pong.png",
    players: { min: 2, max: 2 },
    sdk: "^1.0.0",
    tags: ["classic", "2-player"],
  },
  {
    id: "stick-fight",
    name: "Stick Fight",
    version: "0.0.0",
    engine: "web",
    entry: "/games/stick-fight/index.html",
    thumbnail: "/thumbnails/stick-fight.png",
    players: { min: 2, max: 4 },
    sdk: "^1.0.0",
    tags: ["fighting", "party"],
  },
  {
    id: "party-mix",
    name: "Party Mix",
    version: "0.0.0",
    engine: "web",
    entry: "/games/party-mix/index.html",
    thumbnail: "/thumbnails/party-mix.png",
    players: { min: 2, max: 4 },
    sdk: "^1.0.0",
    tags: ["party", "mini-games"],
  },
];

export const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"] as const;
export const PLAYER_LABELS = ["P1", "P2", "P3", "P4"] as const;
