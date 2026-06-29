import { describe, expect, it } from "vitest";
import { ARENAS, pickArena } from "../src/arenas/index.js";

describe("pickArena with pool 'all'", () => {
  it("cycles through ARENAS in catalog order", () => {
    for (let round = 1; round <= ARENAS.length + 2; round++) {
      const expected = ARENAS[(round - 1) % ARENAS.length].id;
      expect(pickArena(round, "all").id).toBe(expected);
    }
  });
});

describe("pickArena with pool 'random'", () => {
  it("is deterministic for the same (round, seed)", () => {
    const a = pickArena(3, "random", 1234);
    const b = pickArena(3, "random", 1234);
    expect(a.id).toBe(b.id);
  });

  it("can produce different arenas across rounds", () => {
    const ids = new Set<string>();
    for (let round = 1; round <= 12; round++) {
      ids.add(pickArena(round, "random", 99).id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  it("never picks the immediately previous arena", () => {
    let prev = pickArena(1, "random", 7).id;
    for (let round = 2; round <= 24; round++) {
      const next = pickArena(round, "random", 7, prev).id;
      expect(next).not.toBe(prev);
      prev = next;
    }
  });
});

describe("ARENAS catalog", () => {
  it("ships at least 6 arenas after the Henhouse/Coop/Roost expansion", () => {
    expect(ARENAS.length).toBeGreaterThanOrEqual(6);
  });

  it("includes the new arena ids", () => {
    const ids = ARENAS.map((a) => a.id);
    expect(ids).toContain("henhouse");
    expect(ids).toContain("coop");
    expect(ids).toContain("roost");
  });
});
