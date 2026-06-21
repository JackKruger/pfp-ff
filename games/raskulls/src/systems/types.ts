import type { PlayerSlot } from "@pfp/sdk";

export type RaskullsMode = "race" | "arena";

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerStats {
  blocksBroken: number;
  gems: number;
  eliminations: number;
  deaths: number;
  finishMs?: number;
}

export interface RaceRankInput {
  slot: number;
  profileId: string | null;
  progress: number;
  stats: PlayerStats;
}

export interface ArenaRankInput {
  slot: number;
  profileId: string | null;
  lives: number;
  alive: boolean;
  stats: PlayerStats;
}

export interface RankedPlayer {
  slot: number;
  profileId: string | null;
  rank: number;
  score: number;
  stats: PlayerStats;
}

export interface RuntimePlayerSlot extends PlayerSlot {
  keyboardIndex: number;
}
