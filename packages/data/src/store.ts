/**
 * The storage-agnostic persistence interface. The shell depends only on this;
 * the backend can swap from IndexedDB -> file/SQLite -> cloud sync without
 * touching callers (§7).
 */
import type {
  MatchQuery,
  MatchRecord,
  NewMatchRecord,
  NewProfile,
  Profile,
  ProfileUpdate,
} from "./types.js";

export interface DataStore {
  // --- profiles ---
  createProfile(input: NewProfile): Promise<Profile>;
  getProfile(id: string): Promise<Profile | undefined>;
  listProfiles(): Promise<Profile[]>;
  updateProfile(id: string, patch: ProfileUpdate): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;

  // --- matches (append-only source of truth) ---
  recordMatch(input: NewMatchRecord): Promise<MatchRecord>;
  getMatch(id: string): Promise<MatchRecord | undefined>;
  /** Newest first. Optionally filtered by {@link MatchQuery}. */
  listMatches(query?: MatchQuery): Promise<MatchRecord[]>;

  /** Wipe everything. Primarily for tests and a "reset all data" action. */
  clear(): Promise<void>;
}
