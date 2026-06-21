/**
 * In-memory DataStore — no persistence. Used by tests, the dev harness, and as
 * the reference behaviour the IndexedDB store is conformance-checked against.
 */
import type { DataStore } from "./store.js";
import type {
  MatchQuery,
  MatchRecord,
  NewMatchRecord,
  NewProfile,
  Profile,
  ProfileUpdate,
} from "./types.js";
import { applyMatchQuery, compareById, newId, stripUndefined } from "./util.js";

export class InMemoryDataStore implements DataStore {
  private readonly profiles = new Map<string, Profile>();
  private readonly matches = new Map<string, MatchRecord>();

  async createProfile(input: NewProfile): Promise<Profile> {
    const now = Date.now();
    const profile: Profile = {
      id: newId(),
      name: input.name,
      color: input.color,
      ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
      createdAt: now,
      lastPlayedAt: now,
    };
    this.profiles.set(profile.id, profile);
    return clone(profile);
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    const profile = this.profiles.get(id);
    return profile ? clone(profile) : undefined;
  }

  async listProfiles(): Promise<Profile[]> {
    return [...this.profiles.values()]
      .sort((a, b) => a.createdAt - b.createdAt || compareById(a, b))
      .map(clone);
  }

  async updateProfile(id: string, patch: ProfileUpdate): Promise<Profile> {
    const existing = this.profiles.get(id);
    if (!existing) throw new Error(`No profile with id "${id}"`);
    const updated: Profile = { ...existing, ...stripUndefined(patch) };
    this.profiles.set(id, updated);
    return clone(updated);
  }

  async deleteProfile(id: string): Promise<void> {
    this.profiles.delete(id);
  }

  async recordMatch(input: NewMatchRecord): Promise<MatchRecord> {
    // Clone on write so later mutation of the caller's input can't corrupt
    // stored state (IndexedDB structured-clones on put; we match that here).
    const record: MatchRecord = {
      id: newId(),
      gameId: input.gameId,
      playedAt: input.playedAt ?? Date.now(),
      standings: clone(input.standings),
      ...(input.gameStats !== undefined ? { gameStats: clone(input.gameStats) } : {}),
    };
    this.matches.set(record.id, record);
    return clone(record);
  }

  async getMatch(id: string): Promise<MatchRecord | undefined> {
    const match = this.matches.get(id);
    return match ? clone(match) : undefined;
  }

  async listMatches(query?: MatchQuery): Promise<MatchRecord[]> {
    return applyMatchQuery([...this.matches.values()], query).map(clone);
  }

  async clear(): Promise<void> {
    this.profiles.clear();
    this.matches.clear();
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
