/**
 * IndexedDB-backed DataStore — the real local-first persistence used in the
 * browser. Match volumes for couch play are small, so listMatches reads all
 * records and filters in memory (via the shared applyMatchQuery), keeping this
 * implementation simple and behaviourally identical to InMemoryDataStore.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DataStore } from "./store.js";
import type {
  MatchQuery,
  MatchRecord,
  NewMatchRecord,
  NewProfile,
  Profile,
  ProfileUpdate,
} from "./types.js";
import { applyMatchQuery, newId } from "./util.js";

const PROFILES = "profiles";
const MATCHES = "matches";

interface PfpDB extends DBSchema {
  profiles: { key: string; value: Profile };
  matches: { key: string; value: MatchRecord; indexes: { playedAt: number } };
}

export interface IndexedDbDataStoreOptions {
  /** Database name; override for test isolation. Default "pfp". */
  dbName?: string;
}

export class IndexedDbDataStore implements DataStore {
  private readonly dbName: string;
  private dbPromise: Promise<IDBPDatabase<PfpDB>> | undefined;

  constructor(options: IndexedDbDataStoreOptions = {}) {
    this.dbName = options.dbName ?? "pfp";
  }

  private db(): Promise<IDBPDatabase<PfpDB>> {
    this.dbPromise ??= openDB<PfpDB>(this.dbName, 1, {
      upgrade(db) {
        db.createObjectStore(PROFILES, { keyPath: "id" });
        const matches = db.createObjectStore(MATCHES, { keyPath: "id" });
        matches.createIndex("playedAt", "playedAt");
      },
    });
    return this.dbPromise;
  }

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
    await (await this.db()).put(PROFILES, profile);
    return profile;
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    return (await this.db()).get(PROFILES, id);
  }

  async listProfiles(): Promise<Profile[]> {
    const all = await (await this.db()).getAll(PROFILES);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }

  async updateProfile(id: string, patch: ProfileUpdate): Promise<Profile> {
    const db = await this.db();
    const existing = await db.get(PROFILES, id);
    if (!existing) throw new Error(`No profile with id "${id}"`);
    const updated: Profile = { ...existing, ...stripUndefined(patch) };
    await db.put(PROFILES, updated);
    return updated;
  }

  async deleteProfile(id: string): Promise<void> {
    await (await this.db()).delete(PROFILES, id);
  }

  async recordMatch(input: NewMatchRecord): Promise<MatchRecord> {
    const record: MatchRecord = {
      id: newId(),
      gameId: input.gameId,
      playedAt: input.playedAt ?? Date.now(),
      standings: input.standings,
      ...(input.gameStats !== undefined ? { gameStats: input.gameStats } : {}),
    };
    await (await this.db()).put(MATCHES, record);
    return record;
  }

  async getMatch(id: string): Promise<MatchRecord | undefined> {
    return (await this.db()).get(MATCHES, id);
  }

  async listMatches(query?: MatchQuery): Promise<MatchRecord[]> {
    const all = await (await this.db()).getAll(MATCHES);
    return applyMatchQuery(all, query);
  }

  async clear(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction([PROFILES, MATCHES], "readwrite");
    await Promise.all([tx.objectStore(PROFILES).clear(), tx.objectStore(MATCHES).clear()]);
    await tx.done;
  }
}

function stripUndefined<T extends object>(patch: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}
