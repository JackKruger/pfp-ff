import type { GameManifest } from "@pfp/sdk";

const raskullsEntry = import.meta.env.DEV ? "http://localhost:5174/" : "/games/raskulls/index.html";
const pongEntry = import.meta.env.DEV ? "http://localhost:5175/" : "/games/pong/index.html";
const spaceInvadersEntry = import.meta.env.DEV
  ? "http://localhost:5176/"
  : "/games/space-invaders/index.html";
const ironYardEntry = import.meta.env.DEV
  ? "http://localhost:5177/"
  : "/games/iron-yard/index.html";
const partyMixEntry = import.meta.env.DEV
  ? "http://localhost:5178/"
  : "/games/party-mix/index.html";

/** Filterable library categories shown as tabs in the shell header. */
export type GameCategory = "racing" | "classic" | "fighting" | "party";

export const CATEGORY_LABELS: Record<GameCategory, string> = {
  racing: "Racing",
  classic: "Classic",
  fighting: "Fighting",
  party: "Party",
};

/** Local extension: presentation metadata + tracks games that aren't implemented yet. */
export interface GameEntry extends GameManifest {
  disabled?: boolean;
  /** Primary library category (drives the filter tabs). */
  category: GameCategory;
  /** Signature neon used for borders, glows and CTAs on this game's surfaces. */
  accent: string;
  /** Emoji/glyph used in the generated placeholder when no thumbnail exists. */
  icon: string;
  /** One-line pitch shown on the featured hero banner. */
  blurb: string;
  /** Wide art used by the featured hero banner. Falls back to thumbnail. */
  heroArt?: string;
  /** Promote to the hero banner at the top of the library. */
  featured?: boolean;
}

/** Games known to the shell. Disabled entries are placeholders shown as Coming Soon. */
export const GAMES: GameEntry[] = [
  {
    id: "raskulls",
    name: "Raskulls",
    version: "0.0.0",
    engine: "web",
    entry: raskullsEntry,
    players: { min: 2, max: 4 },
    sdk: "^1.0.0",
    tags: ["racing", "arena"],
    category: "racing",
    accent: "#f59e0b",
    thumbnail: "/thumbnails/raskulls.png",
    heroArt: "/hero/raskulls.png",
    icon: "🏁",
    blurb: "Smash, dash and gem-grab your way to the finish in a chaotic block-breaking race.",
    featured: true,
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
    version: "0.1.0",
    engine: "web",
    entry: pongEntry,
    thumbnail: "/thumbnails/pong.png",
    players: { min: 2, max: 2 },
    sdk: "^1.0.0",
    tags: ["classic", "2-player"],
    category: "classic",
    accent: "#4f9dff",
    icon: "🏓",
    blurb: "The original duel. First to outlast your rival across the neon table.",
    statKeys: {
      score: { label: "Score", scope: "player" },
      durationMs: { label: "Duration", scope: "match" },
    },
  },
  {
    id: "space-invaders",
    name: "Space Invaders",
    version: "0.1.0",
    engine: "web",
    entry: spaceInvadersEntry,
    players: { min: 1, max: 4 },
    sdk: "^1.0.0",
    tags: ["classic", "co-op", "arcade"],
    category: "classic",
    accent: "#22c55e",
    thumbnail: "/thumbnails/space-invaders.png",
    icon: "👾",
    blurb: "Hold the line together. Co-op waves of descending invaders, four cannons strong.",
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
    category: "fighting",
    accent: "#ff3b6b",
    icon: "🥊",
    blurb: "Ragdoll brawls with absurd weapons. Last stick standing wins the round.",
    disabled: true,
  },
  {
    id: "iron-yard",
    name: "Iron Yard",
    version: "0.1.0",
    engine: "web",
    entry: ironYardEntry,
    players: { min: 1, max: 4 },
    sdk: "^1.0.0",
    tags: ["fighting", "medieval", "physics"],
    category: "fighting",
    accent: "#f97316",
    thumbnail: "/thumbnails/iron-yard.png",
    icon: "⚔️",
    blurb: "Medieval physics carnage. Forge weapons in the yard and batter your friends.",
    statKeys: {
      kills: { label: "Kills", scope: "player" },
      deaths: { label: "Deaths", scope: "player" },
    },
  },
  {
    id: "party-mix",
    name: "Party Mix",
    version: "0.1.0",
    engine: "web",
    entry: partyMixEntry,
    thumbnail: "/thumbnails/party-mix.png",
    players: { min: 2, max: 4 },
    sdk: "^1.0.0",
    tags: ["party", "mini-games"],
    category: "party",
    accent: "#c084fc",
    icon: "🎉",
    blurb: "A whirlwind of bite-sized minigames. Collect stars across the board to win the night.",
    statKeys: {
      stars: { label: "Stars", scope: "player" },
      coins: { label: "Coins", scope: "player" },
      minigamesWon: { label: "Minigames Won", scope: "player" },
      rounds: { label: "Rounds", scope: "match" },
      durationMs: { label: "Duration", scope: "match" },
    },
    disabled: true,
  },
];

export const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"] as const;
export const PLAYER_LABELS = ["P1", "P2", "P3", "P4"] as const;
