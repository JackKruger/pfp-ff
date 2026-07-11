/**
 * Cross-manifest invariants for the shipped game catalog. These are the
 * collisions nothing else checks: duplicate ids would corrupt match records
 * and stats, and duplicate dev ports make `pnpm dev` servers fight over a
 * port (strictPort) or silently serve the wrong game into an iframe.
 */
import { describe, expect, it } from "vitest";
import { GAME_MANIFESTS } from "../src/games.generated.js";

function duplicates<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const dups = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) dups.add(value);
    seen.add(value);
  }
  return [...dups];
}

describe("game catalog invariants", () => {
  it("has a unique id per game", () => {
    expect(duplicates(GAME_MANIFESTS.map((m) => m.id))).toEqual([]);
  });

  it("has a unique dev port per game", () => {
    const ports = GAME_MANIFESTS.map((m) => m.build?.devPort).filter(
      (port): port is number => port !== undefined,
    );
    expect(duplicates(ports)).toEqual([]);
  });

  it("has a unique entry document per game", () => {
    expect(duplicates(GAME_MANIFESTS.map((m) => m.entry))).toEqual([]);
  });

  it("declares a sane player range", () => {
    for (const manifest of GAME_MANIFESTS) {
      expect(manifest.players.min, manifest.id).toBeGreaterThanOrEqual(1);
      expect(manifest.players.max, manifest.id).toBeGreaterThanOrEqual(manifest.players.min);
      expect(manifest.players.max, manifest.id).toBeLessThanOrEqual(4);
    }
  });
});
