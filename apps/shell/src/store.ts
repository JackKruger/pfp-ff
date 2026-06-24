import { create } from "zustand";
import { IndexedDbDataStore } from "@pfp/data";
import type { GameManifest, GameResult } from "@pfp/sdk";
import type { MatchRecord, Profile } from "@pfp/data";
import type { PairingSlot } from "@pfp/input";
import {
  defaultSettingsFor,
  setGameSetting,
  type GameSettingsState,
} from "./gameSettings.js";

export type Screen = "home" | "profiles" | "pairing" | "game" | "results" | "stats";

const dataStore = new IndexedDbDataStore({ dbName: "pfp-ff" });

interface ShellState {
  screen: Screen;
  dataReady: boolean;
  selectedGame: GameManifest | null;
  selectedGameSettings: GameSettingsState;
  pairedSlots: PairingSlot[];
  lastResult: GameResult | null;
  profiles: Profile[];
  matches: MatchRecord[];

  navigate(to: Screen): void;
  selectGame(game: GameManifest): void;
  setSelectedGameSettings(settings: GameSettingsState): void;
  updateSelectedGameSetting(id: string, value: unknown): void;
  setPairedSlots(slots: PairingSlot[]): void;
  setResult(result: GameResult): void;

  loadData(): Promise<void>;
  createProfile(input: { name: string; color: string }): Promise<void>;
  updateProfile(id: string, patch: { name?: string; color?: string }): Promise<void>;
  deleteProfile(id: string): Promise<void>;
  recordMatch(result: GameResult): Promise<void>;
}

export const useShell = create<ShellState>((set, get) => ({
  screen: "home",
  dataReady: false,
  selectedGame: null,
  selectedGameSettings: {},
  pairedSlots: [],
  lastResult: null,
  profiles: [],
  matches: [],

  navigate(to) {
    set({ screen: to });
  },

  selectGame(game) {
    set({ selectedGame: game, selectedGameSettings: defaultSettingsFor(game) });
  },

  setSelectedGameSettings(settings) {
    set({ selectedGameSettings: settings });
  },

  updateSelectedGameSetting(id, value) {
    set((state) => {
      if (!state.selectedGame) return state;
      return {
        selectedGameSettings: setGameSetting(
          state.selectedGame,
          state.selectedGameSettings,
          id,
          value,
        ),
      };
    });
  },

  setPairedSlots(slots) {
    set({ pairedSlots: slots });
  },

  setResult(result) {
    set({ lastResult: result });
  },

  async loadData() {
    const [profiles, matches] = await Promise.all([
      dataStore.listProfiles(),
      dataStore.listMatches(),
    ]);
    set({ profiles, matches, dataReady: true });
  },

  async createProfile(input) {
    const profile = await dataStore.createProfile(input);
    set((s) => ({ profiles: [...s.profiles, profile] }));
  },

  async updateProfile(id, patch) {
    const updated = await dataStore.updateProfile(id, patch);
    set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? updated : p)) }));
  },

  async deleteProfile(id) {
    await dataStore.deleteProfile(id);
    set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
  },

  async recordMatch(result) {
    // Store the match under its ending timestamp (playedAt ≈ completedAt).
    const record = await dataStore.recordMatch({
      gameId: result.gameId,
      playedAt: result.endedAt,
      standings: result.standings,
      ...(result.gameStats !== undefined ? { gameStats: result.gameStats } : {}),
    });
    set((s) => ({ matches: [record, ...s.matches] }));
    const { screen } = get();
    if (screen === "game") get().navigate("results");

    const updatedProfiles = await updateProfilesLastPlayedAt(
      participatingProfileIds(result),
      result.endedAt,
    );
    if (updatedProfiles.length > 0) {
      set((s) => ({ profiles: mergeUpdatedProfiles(s.profiles, updatedProfiles) }));
    }
  },
}));

function participatingProfileIds(result: GameResult): string[] {
  const ids = new Set<string>();
  for (const standing of result.standings) {
    if (standing.profileId !== null) ids.add(standing.profileId);
  }
  return [...ids];
}

async function updateProfilesLastPlayedAt(
  profileIds: string[],
  lastPlayedAt: number,
): Promise<Profile[]> {
  const updated = await Promise.all(
    profileIds.map(async (profileId) => {
      try {
        return await dataStore.updateProfile(profileId, { lastPlayedAt });
      } catch (error) {
        console.warn(`Failed to update lastPlayedAt for profile "${profileId}"`, error);
        return null;
      }
    }),
  );
  return updated.filter((profile): profile is Profile => profile !== null);
}

function mergeUpdatedProfiles(profiles: Profile[], updatedProfiles: Profile[]): Profile[] {
  const updatedById = new Map(updatedProfiles.map((profile) => [profile.id, profile]));
  return profiles.map((profile) => updatedById.get(profile.id) ?? profile);
}
