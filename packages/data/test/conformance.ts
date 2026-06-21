/**
 * Behavioural contract every DataStore must satisfy. Run against each
 * implementation so InMemoryDataStore and IndexedDbDataStore stay identical.
 */
import { describe, expect, it } from "vitest";
import type { DataStore } from "../src/index.js";
import type { PlayerStanding } from "@pfp/sdk";

function standing(profileId: string | null, rank: number, score?: number): PlayerStanding {
  return {
    slot: 0,
    profileId,
    rank,
    ...(score !== undefined ? { score } : {}),
  };
}

export function runDataStoreConformance(name: string, createStore: () => DataStore): void {
  describe(`DataStore conformance: ${name}`, () => {
    describe("profiles", () => {
      it("creates, reads, lists, updates, deletes", async () => {
        const store = createStore();

        const ann = await store.createProfile({ name: "Ann", color: "#f00" });
        expect(ann.id).toBeTruthy();
        expect(ann.createdAt).toBeGreaterThan(0);
        expect(ann.lastPlayedAt).toBe(ann.createdAt);

        expect(await store.getProfile(ann.id)).toEqual(ann);
        expect(await store.getProfile("missing")).toBeUndefined();

        await store.createProfile({ name: "Bob", color: "#00f" });
        const list = await store.listProfiles();
        expect(list.map((p) => p.name)).toEqual(["Ann", "Bob"]);

        const renamed = await store.updateProfile(ann.id, { name: "Annie" });
        expect(renamed.name).toBe("Annie");
        expect((await store.getProfile(ann.id))?.name).toBe("Annie");

        await store.deleteProfile(ann.id);
        expect(await store.getProfile(ann.id)).toBeUndefined();
        expect(await store.listProfiles()).toHaveLength(1);
      });

      it("throws when updating a missing profile", async () => {
        const store = createStore();
        await expect(store.updateProfile("nope", { name: "x" })).rejects.toThrow();
      });

      it("does not mutate stored profiles via returned references", async () => {
        const store = createStore();
        const p = await store.createProfile({ name: "Ann", color: "#f00" });
        p.name = "TAMPERED";
        expect((await store.getProfile(p.id))?.name).toBe("Ann");
      });
    });

    describe("matches", () => {
      it("records and reads back a match, defaulting playedAt", async () => {
        const store = createStore();
        const before = Date.now();
        const match = await store.recordMatch({
          gameId: "pong",
          standings: [standing("p1", 1, 11), standing("p2", 2, 7)],
        });
        expect(match.id).toBeTruthy();
        expect(match.playedAt).toBeGreaterThanOrEqual(before);
        expect(await store.getMatch(match.id)).toEqual(match);
      });

      it("lists newest-first and filters by game, profile, since, limit", async () => {
        const store = createStore();
        await store.recordMatch({
          gameId: "pong",
          playedAt: 1000,
          standings: [standing("p1", 1), standing("p2", 2)],
        });
        await store.recordMatch({
          gameId: "smash",
          playedAt: 2000,
          standings: [standing("p2", 1), standing("p3", 2)],
        });
        await store.recordMatch({
          gameId: "pong",
          playedAt: 3000,
          standings: [standing("p3", 1), standing("p1", 2)],
        });

        const all = await store.listMatches();
        expect(all.map((m) => m.playedAt)).toEqual([3000, 2000, 1000]);

        const pong = await store.listMatches({ gameId: "pong" });
        expect(pong.map((m) => m.playedAt)).toEqual([3000, 1000]);

        const p1 = await store.listMatches({ profileId: "p1" });
        expect(p1.map((m) => m.playedAt)).toEqual([3000, 1000]);

        const recent = await store.listMatches({ since: 2000 });
        expect(recent.map((m) => m.playedAt)).toEqual([3000, 2000]);

        const limited = await store.listMatches({ limit: 1 });
        expect(limited.map((m) => m.playedAt)).toEqual([3000]);
      });

      it("orders equal-playedAt matches deterministically (by id)", async () => {
        const store = createStore();
        const ids: string[] = [];
        for (let i = 0; i < 3; i++) {
          const m = await store.recordMatch({
            gameId: "pong",
            playedAt: 5000, // identical timestamp for all three
            standings: [standing("p1", 1)],
          });
          ids.push(m.id);
        }
        const order = (await store.listMatches()).map((m) => m.id);
        // Stable, backend-independent tiebreak: ascending id.
        expect(order).toEqual([...ids].sort());
      });

      it("isolates stored/returned data from later caller mutation", async () => {
        const store = createStore();
        const standings = [standing("p1", 1)];
        const recorded = await store.recordMatch({ gameId: "pong", standings });

        standings.push(standing("p2", 2)); // mutate the caller's array afterwards

        expect(recorded.standings).toHaveLength(1);
        expect((await store.getMatch(recorded.id))?.standings).toHaveLength(1);
      });
    });

    it("clear wipes profiles and matches", async () => {
      const store = createStore();
      await store.createProfile({ name: "Ann", color: "#f00" });
      await store.recordMatch({ gameId: "pong", standings: [standing("p1", 1)] });
      await store.clear();
      expect(await store.listProfiles()).toHaveLength(0);
      expect(await store.listMatches()).toHaveLength(0);
    });
  });
}
