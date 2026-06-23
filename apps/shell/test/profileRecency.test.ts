import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchRecord, Profile, ProfileUpdate } from "@pfp/data";
import type { GameResult } from "@pfp/sdk";

const { dataStore } = vi.hoisted(() => ({
  dataStore: {
    listProfiles: vi.fn(),
    listMatches: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
    recordMatch: vi.fn(),
  },
}));

vi.mock("@pfp/data", () => ({
  IndexedDbDataStore: vi.fn(() => dataStore),
}));

import { useShell } from "../src/store.js";

describe("profile recency", () => {
  beforeEach(() => {
    dataStore.recordMatch.mockReset();
    dataStore.updateProfile.mockReset();
    dataStore.recordMatch.mockImplementation(
      async (input: MatchRecordInput): Promise<MatchRecord> => ({
        id: "match-1",
        gameId: input.gameId,
        playedAt: input.playedAt ?? 0,
        standings: input.standings,
        ...(input.gameStats !== undefined ? { gameStats: input.gameStats } : {}),
      }),
    );

    useShell.setState({
      screen: "home",
      dataReady: false,
      selectedGame: null,
      pairedSlots: [],
      lastResult: null,
      profiles: [],
      matches: [],
    });
  });

  it("updates lastPlayedAt for a single participating profile", async () => {
    const ann = profile({ id: "p1", name: "Ann", lastPlayedAt: 100 });
    const updatedAnn = { ...ann, name: "Ann from store", lastPlayedAt: 250 };
    dataStore.updateProfile.mockResolvedValueOnce(updatedAnn);
    useShell.setState({ profiles: [ann] });

    await useShell.getState().recordMatch(
      result({
        endedAt: 250,
        standings: [{ slot: 0, profileId: "p1", rank: 1 }],
      }),
    );

    expect(dataStore.recordMatch).toHaveBeenCalledWith({
      gameId: "pong",
      playedAt: 250,
      standings: [{ slot: 0, profileId: "p1", rank: 1 }],
    });
    expect(dataStore.updateProfile).toHaveBeenCalledWith("p1", { lastPlayedAt: 250 });
    expect(useShell.getState().matches[0]).toMatchObject({ id: "match-1", playedAt: 250 });
    expect(useShell.getState().profiles).toEqual([updatedAnn]);
  });

  it("updates lastPlayedAt for multiple participating profiles", async () => {
    const ann = profile({ id: "p1", name: "Ann" });
    const ben = profile({ id: "p2", name: "Ben" });
    dataStore.updateProfile.mockImplementation(async (id: string, patch: ProfileUpdate) => {
      const existing = id === "p1" ? ann : ben;
      return { ...existing, ...patch };
    });
    useShell.setState({ profiles: [ann, ben] });

    await useShell.getState().recordMatch(
      result({
        endedAt: 300,
        standings: [
          { slot: 0, profileId: "p1", rank: 1 },
          { slot: 1, profileId: "p2", rank: 2 },
        ],
      }),
    );

    expect(dataStore.updateProfile).toHaveBeenCalledTimes(2);
    expect(dataStore.updateProfile).toHaveBeenNthCalledWith(1, "p1", { lastPlayedAt: 300 });
    expect(dataStore.updateProfile).toHaveBeenNthCalledWith(2, "p2", { lastPlayedAt: 300 });
    expect(useShell.getState().profiles.map((p) => [p.id, p.lastPlayedAt])).toEqual([
      ["p1", 300],
      ["p2", 300],
    ]);
  });

  it("ignores guest standings", async () => {
    const ann = profile({ id: "p1", name: "Ann", lastPlayedAt: 100 });
    useShell.setState({ profiles: [ann] });

    await useShell.getState().recordMatch(
      result({
        endedAt: 350,
        standings: [{ slot: 0, profileId: null, rank: 1 }],
      }),
    );

    expect(dataStore.recordMatch).toHaveBeenCalledTimes(1);
    expect(dataStore.updateProfile).not.toHaveBeenCalled();
    expect(useShell.getState().profiles).toEqual([ann]);
  });

  it("updates duplicate profile ids once per match", async () => {
    const ann = profile({ id: "p1", name: "Ann" });
    dataStore.updateProfile.mockResolvedValueOnce({ ...ann, lastPlayedAt: 400 });
    useShell.setState({ profiles: [ann] });

    await useShell.getState().recordMatch(
      result({
        endedAt: 400,
        standings: [
          { slot: 0, profileId: "p1", rank: 1 },
          { slot: 1, profileId: "p1", rank: 2 },
          { slot: 2, profileId: null, rank: 3 },
        ],
      }),
    );

    expect(dataStore.updateProfile).toHaveBeenCalledTimes(1);
    expect(dataStore.updateProfile).toHaveBeenCalledWith("p1", { lastPlayedAt: 400 });
    expect(useShell.getState().profiles[0]?.lastPlayedAt).toBe(400);
  });

  it("keeps match recording and results navigation when a recency update fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ann = profile({ id: "p1", name: "Ann", lastPlayedAt: 100 });
    dataStore.updateProfile.mockRejectedValueOnce(new Error("profile write failed"));
    useShell.setState({ screen: "game", profiles: [ann] });

    await expect(
      useShell.getState().recordMatch(
        result({
          endedAt: 450,
          standings: [{ slot: 0, profileId: "p1", rank: 1 }],
        }),
      ),
    ).resolves.toBeUndefined();

    expect(useShell.getState().matches).toHaveLength(1);
    expect(useShell.getState().screen).toBe("results");
    expect(useShell.getState().profiles).toEqual([ann]);
    expect(warn).toHaveBeenCalledOnce();

    warn.mockRestore();
  });
});

type MatchRecordInput = Parameters<typeof dataStore.recordMatch>[0];

function profile(overrides: Partial<Profile> & Pick<Profile, "id">): Profile {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    color: overrides.color ?? "#ff00aa",
    createdAt: overrides.createdAt ?? 1,
    lastPlayedAt: overrides.lastPlayedAt ?? 1,
    ...(overrides.avatar !== undefined ? { avatar: overrides.avatar } : {}),
  };
}

function result(overrides: Pick<GameResult, "endedAt" | "standings">): GameResult {
  return {
    gameId: "pong",
    sessionId: "session-1",
    startedAt: 1,
    ...overrides,
  };
}
