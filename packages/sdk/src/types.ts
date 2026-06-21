/**
 * The data model of the game contract. See docs/ARCHITECTURE.md §5.
 *
 * These types are shared verbatim by the shell host and every game (native-TS or
 * Godot-export), so they are the single source of truth for the protocol's shape.
 */

/** Which engine a game is built with — purely informational to the host. */
export type GameEngine = "web" | "godot";

/** Optional label/grouping metadata for a freeform stat key (see §5.4). */
export interface StatKeyDef {
  label: string;
  /** Whether the stat is reported per-player or once for the whole match. */
  scope: "player" | "match";
}

/** A per-game achievement definition declared in the manifest (see §7.2). */
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Points this contributes to a profile's overall score when unlocked. */
  points: number;
  icon?: string;
  secret?: boolean;
}

/** `game.json` — what a game ships so the shell can list and launch it (§5.1). */
export interface GameManifest {
  /** Unique, stable, kebab-case id. */
  id: string;
  name: string;
  version: string;
  engine: GameEngine;
  /** Entry document loaded into the iframe, relative to the game root. */
  entry: string;
  players: { min: number; max: number };
  thumbnail?: string;
  tags?: string[];
  /** Semver range of the contract this game targets, e.g. "^1.0.0". */
  sdk: string;
  /** Optional labels for the freeform stat keys this game emits. Metadata only. */
  statKeys?: Record<string, StatKeyDef>;
  /** Optional per-game achievements. */
  achievements?: AchievementDef[];
}

/** One player position in a match, bound to a controller and (maybe) a profile. */
export interface PlayerSlot {
  /** 0..3 — P1..P4. */
  slot: number;
  /** null = guest (not a saved profile). */
  profileId: string | null;
  displayName: string;
  /** The player's identity color (hex). */
  color: string;
  /** Index into navigator.getGamepads() for this slot's controller. */
  gamepadIndex: number;
}

/** Sent shell -> game on launch: who's playing and on which controllers (§5.2). */
export interface LaunchContext {
  /** Unique per match. */
  sessionId: string;
  sdkVersion: string;
  players: PlayerSlot[];
  /** Optional per-game options chosen in the shell. */
  settings: Record<string, unknown>;
}

/** Where one player placed in a match, plus optional freeform stats (§5.4). */
export interface PlayerStanding {
  slot: number;
  profileId: string | null;
  /** 1 = winner; ties share a rank. */
  rank: number;
  /** Optional numeric score. */
  score?: number;
  /** Game-defined per-player stats, e.g. { kos: 7, falls: 2 }. */
  stats?: Record<string, number>;
}

/** The result a game reports on finish (§5.4). Every game reduces to this. */
export interface GameResult {
  gameId: string;
  sessionId: string;
  /** epoch ms */
  startedAt: number;
  /** epoch ms */
  endedAt: number;
  standings: PlayerStanding[];
  /** Freeform, game-defined match-level data. */
  gameStats?: Record<string, unknown>;
  /** Ids of achievements the game itself determined were unlocked (§7.2). */
  achievements?: string[];
}
