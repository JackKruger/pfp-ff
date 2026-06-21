import { describe, expect, it } from "vitest";
import { computeLeaderboard, computeProfileStats, type MatchRecord } from "../src/index.js";

function match(
  gameId: string,
  playedAt: number,
  standings: Array<[profileId: string | null, rank: number, score?: number]>,
): MatchRecord {
  return {
    id: `${gameId}-${playedAt}`,
    gameId,
    playedAt,
    standings: standings.map(([profileId, rank, score]) => ({
      slot: 0,
      profileId,
      rank,
      ...(score !== undefined ? { score } : {}),
    })),
  };
}

describe("computeProfileStats", () => {
  const matches: MatchRecord[] = [
    match("pong", 1000, [["p1", 1, 11], ["p2", 2, 5]]),
    match("pong", 2000, [["p1", 2, 8], ["p2", 1, 11]]),
    match("smash", 3000, [["p1", 1], ["p2", 2], ["p3", 3]]),
  ];

  it("aggregates totals and per-game breakdown", () => {
    const stats = computeProfileStats("p1", matches);
    expect(stats.totalPlayed).toBe(3);
    expect(stats.totalWins).toBe(2);
    expect(stats.winRate).toBeCloseTo(2 / 3);

    const pong = stats.perGame.find((g) => g.gameId === "pong");
    expect(pong).toMatchObject({ played: 2, wins: 1, bestScore: 11 });
    expect(pong?.winRate).toBeCloseTo(0.5);

    // per-game sorted most-recently-played first
    expect(stats.perGame.map((g) => g.gameId)).toEqual(["smash", "pong"]);
  });

  it("counts tied first places as wins", () => {
    const tied = [match("party", 1, [["p1", 1], ["p2", 1], ["p3", 3]])];
    expect(computeProfileStats("p1", tied).totalWins).toBe(1);
    expect(computeProfileStats("p2", tied).totalWins).toBe(1);
    expect(computeProfileStats("p3", tied).totalWins).toBe(0);
  });

  it("returns zeroed stats for a profile that never played", () => {
    const stats = computeProfileStats("ghost", matches);
    expect(stats).toMatchObject({ totalPlayed: 0, totalWins: 0, winRate: 0 });
    expect(stats.perGame).toEqual([]);
  });
});

describe("computeLeaderboard", () => {
  const matches: MatchRecord[] = [
    match("pong", 1000, [["p1", 1], ["p2", 2]]),
    match("pong", 2000, [["p1", 1], ["p2", 2]]),
    match("smash", 3000, [["p2", 1], ["p1", 2], [null, 3]]),
  ];

  it("ranks across all games by wins then win-rate", () => {
    const board = computeLeaderboard(matches);
    expect(board.map((e) => e.profileId)).toEqual(["p1", "p2"]);
    expect(board[0]).toMatchObject({ profileId: "p1", played: 3, wins: 2 });
  });

  it("scopes to a single game", () => {
    const board = computeLeaderboard(matches, { gameId: "smash" });
    expect(board[0]).toMatchObject({ profileId: "p2", wins: 1 });
  });

  it("excludes guests (null profileId)", () => {
    const board = computeLeaderboard(matches);
    expect(board.some((e) => e.profileId === null)).toBe(false);
  });
});
