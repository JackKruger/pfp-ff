import type { PlayerStats, RankedPlayer } from "./types.js";

export type ChallengeId = "time-trial" | "ammo-scrooge" | "bomb-disposal" | "frenzy-run";

export interface ChallengeDefinition {
  id: ChallengeId;
  name: string;
  levelId: string;
  timeLimitMs: number;
  wandLimit?: number;
  bombTargetCount?: number;
  bombTargetTiles?: Array<{ tileX: number; tileY: number }>;
  minFrenzyUptimeMs?: number;
}

export interface ChallengePlayerRuntime {
  slot: number;
  profileId: string | null;
  wandUsesRemaining: number;
  bombTargetsCleared: number;
  frenzyUptimeMs: number;
}

export interface ChallengeRuntime {
  definition: ChallengeDefinition;
  players: ChallengePlayerRuntime[];
}

export type ChallengeEvent =
  | { type: "wand-used"; slot: number }
  | { type: "bomb-target-cleared"; slot: number }
  | { type: "frenzy-uptime"; slot: number; deltaMs: number };

export interface ChallengeRankInput {
  slot: number;
  profileId: string | null;
  stats: PlayerStats;
  wandUsesRemaining?: number;
  bombTargetsCleared?: number;
  frenzyUptimeMs?: number;
}

const CHALLENGES: readonly ChallengeDefinition[] = [
  {
    id: "time-trial",
    name: "Time Trial",
    levelId: "dig-rush",
    timeLimitMs: 90_000,
  },
  {
    id: "ammo-scrooge",
    name: "Ammo Scrooge",
    levelId: "cliff-climb",
    timeLimitMs: 130_000,
    wandLimit: 18,
  },
  {
    id: "bomb-disposal",
    name: "Bomb Disposal",
    levelId: "gray-gambit",
    timeLimitMs: 120_000,
    bombTargetCount: 3,
    bombTargetTiles: [
      { tileX: 22, tileY: 17 },
      { tileX: 40, tileY: 17 },
      { tileX: 58, tileY: 16 },
    ],
  },
  {
    id: "frenzy-run",
    name: "Frenzy Run",
    levelId: "dig-rush",
    timeLimitMs: 95_000,
    minFrenzyUptimeMs: 12_000,
  },
];

export function challengeDefinitions(): readonly ChallengeDefinition[] {
  return CHALLENGES;
}

export function challengeDefinition(id: ChallengeId): ChallengeDefinition {
  return CHALLENGES.find((challenge) => challenge.id === id) ?? CHALLENGES[0]!;
}

export function createChallengeRuntime(
  id: ChallengeId,
  players: Array<{ slot: number; profileId: string | null }>,
): ChallengeRuntime {
  const definition = challengeDefinition(id);
  return {
    definition,
    players: players.map((player) => ({
      slot: player.slot,
      profileId: player.profileId,
      wandUsesRemaining: definition.wandLimit ?? Number.POSITIVE_INFINITY,
      bombTargetsCleared: 0,
      frenzyUptimeMs: 0,
    })),
  };
}

export function applyChallengeEvent(runtime: ChallengeRuntime, event: ChallengeEvent): void {
  const player = runtime.players.find((candidate) => candidate.slot === event.slot);
  if (!player) return;

  if (event.type === "wand-used") {
    player.wandUsesRemaining = Math.max(0, player.wandUsesRemaining - 1);
  } else if (event.type === "bomb-target-cleared") {
    player.bombTargetsCleared += 1;
  } else {
    player.frenzyUptimeMs += Math.max(0, event.deltaMs);
  }
}

export function rankChallengePlayers(
  id: ChallengeId,
  players: ChallengeRankInput[],
): RankedPlayer[] {
  const sorted = [...players].sort((a, b) => compareChallengePlayers(id, a, b));
  return sorted.map((player, index) => ({
    slot: player.slot,
    profileId: player.profileId,
    rank: index + 1,
    score: challengeScore(id, player),
    stats: player.stats,
  }));
}

function compareChallengePlayers(
  id: ChallengeId,
  a: ChallengeRankInput,
  b: ChallengeRankInput,
): number {
  if (id === "ammo-scrooge") {
    const remaining = (b.wandUsesRemaining ?? 0) - (a.wandUsesRemaining ?? 0);
    if (remaining !== 0) return remaining;
  } else if (id === "bomb-disposal") {
    const cleared = (b.bombTargetsCleared ?? 0) - (a.bombTargetsCleared ?? 0);
    if (cleared !== 0) return cleared;
  } else if (id === "frenzy-run") {
    const uptime = (b.frenzyUptimeMs ?? 0) - (a.frenzyUptimeMs ?? 0);
    if (uptime !== 0) return uptime;
  }

  return (a.stats.finishMs ?? Infinity) - (b.stats.finishMs ?? Infinity);
}

function challengeScore(id: ChallengeId, player: ChallengeRankInput): number {
  if (id === "ammo-scrooge") return player.wandUsesRemaining ?? 0;
  if (id === "bomb-disposal") return player.bombTargetsCleared ?? 0;
  if (id === "frenzy-run") return Math.round((player.frenzyUptimeMs ?? 0) / 1000);
  return Math.max(0, 100_000 - (player.stats.finishMs ?? 100_000));
}
