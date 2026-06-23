import { describe, expect, it } from "vitest";
import { buildStandings } from "../src/pfp/results.js";

interface Standing {
  slot: number;
  rank: number;
  stats?: Record<string, number>;
}

describe("Stick Smash result adapter", () => {
  it("forces the winner to rank first", () => {
    const winner = player({ slot: 1, lives: 1, score: 0, deaths: 4 });
    const standings = buildStandings({
      launchedPlayers: launchedPlayers(2),
      players: [player({ slot: 0, lives: 5, score: 9, deaths: 0 }), winner],
      winner,
    });

    expect((standings as Standing[]).find((standing) => standing.slot === 1)?.rank).toBe(1);
  });

  it("sorts non-winner ranks by lives, kills, then deaths", () => {
    const standings = buildStandings({
      launchedPlayers: launchedPlayers(4),
      players: [
        player({ slot: 0, lives: 1, score: 5, deaths: 2 }),
        player({ slot: 1, lives: 3, score: 1, deaths: 3 }),
        player({ slot: 2, lives: 1, score: 7, deaths: 4 }),
        player({ slot: 3, lives: 1, score: 5, deaths: 1 }),
      ],
      winner: null,
    });

    expect(rankOf(standings, 1)).toBe(1);
    expect(rankOf(standings, 2)).toBe(2);
    expect(rankOf(standings, 3)).toBe(3);
    expect(rankOf(standings, 0)).toBe(4);
  });

  it("includes every launched PFP player", () => {
    const standings = buildStandings({
      launchedPlayers: launchedPlayers(3),
      players: [player({ slot: 0, lives: 2, score: 1, deaths: 0 })],
      winner: null,
    });

    expect((standings as Standing[]).map((standing) => standing.slot)).toEqual([0, 1, 2]);
    expect(standings[1]?.stats).toEqual({ kills: 0, deaths: 0, lives: 0 });
  });
});

function rankOf(standings: Standing[], slot: number): number | undefined {
  return standings.find((standing) => standing.slot === slot)?.rank;
}

function launchedPlayers(count: number) {
  return Array.from({ length: count }, (_, slot) => ({
    slot,
    profileId: `profile-${slot}`,
    displayName: `P${slot + 1}`,
    color: "#fff",
    gamepadIndex: slot,
  }));
}

function player({
  slot,
  lives,
  score,
  deaths,
}: {
  slot: number;
  lives: number;
  score: number;
  deaths: number;
}) {
  return {
    pfpSlot: slot,
    inputSource: { kind: "pfp", slot },
    lives,
    score,
    deaths,
  };
}
