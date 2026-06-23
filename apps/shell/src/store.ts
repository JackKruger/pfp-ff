import { create } from "zustand";
import { IndexedDbDataStore } from "@pfp/data";
import type { GameManifest, GameResult } from "@pfp/sdk";
import type { MatchRecord, Profile } from "@pfp/data";
import type { PairingSlot } from "@pfp/input";

export type Screen = "home" | "profiles" | "pairing" | "game" | "results" | "stats";

const dataStore = new IndexedDbDataStore({ dbName: "pfp-ff" });

interface ShellState {
  screen: Screen;
  dataReady: boolean;
  selectedGame: GameManifest | null;
  pairedSlots: PairingSlot[];
  lastResult: GameResult | null;
  profiles: Profile[];
  matches: MatchRecord[];

  navigate(to: Screen): void;
  selectGame(game: GameManifest): void;
  clearGame(): void;
  setPairedSlots(slots: PairingSlot[]): void;
  setResult(result: GameResult): void;
  addSessionSlot(gamepadIndex: number): void;
  removeSessionSlot(gamepadIndex: number): void;

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
  pairedSlots: [],
  lastResult: null,
  profiles: [],
  matches: [],

  navigate(to) {
    set({ screen: to });
  },

  selectGame(game) {
    set({ selectedGame: game });
  },

  clearGame() {
    set({ selectedGame: null });
  },

  setPairedSlots(slots) {
    set({ pairedSlots: slots });
  },

  setResult(result) {
    set({ lastResult: result });
  },

  addSessionSlot(gamepadIndex) {
    const { pairedSlots } = get();
    if (pairedSlots.some((s) => s.gamepadIndex === gamepadIndex)) return;
    const occupied = new Set(pairedSlots.map((s) => s.slot));
    let slot = 0;
    while (occupied.has(slot)) slot++;
    if (slot >= 4) return;
    set((s) => ({
      pairedSlots: [...s.pairedSlots, { slot, gamepadIndex, profileId: null }].sort(
        (a, b) => a.slot - b.slot,
      ),
    }));
  },

  removeSessionSlot(gamepadIndex) {
    set((s) => ({
      pairedSlots: s.pairedSlots.filter((sl) => sl.gamepadIndex !== gamepadIndex),
    }));
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
  },
}));
