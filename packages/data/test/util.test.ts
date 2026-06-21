import { describe, expect, it } from "vitest";
import { newId } from "../src/util.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  it("produces unique v4-shaped UUIDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = newId();
      expect(id).toMatch(UUID_RE);
      ids.add(id);
    }
    expect(ids.size).toBe(1000);
  });

  it("falls back to getRandomValues when randomUUID is unavailable", () => {
    // Simulate a non-secure context (e.g. plain-HTTP LAN play) where
    // crypto.randomUUID is not exposed.
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
    try {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const id = newId();
        expect(id).toMatch(UUID_RE);
        ids.add(id);
      }
      expect(ids.size).toBe(100);
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        value: original,
        configurable: true,
      });
    }
  });
});
