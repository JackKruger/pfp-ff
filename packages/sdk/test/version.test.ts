import { describe, expect, it } from "vitest";
import { parseVersion, satisfies } from "../src/version.js";

describe("parseVersion", () => {
  it("parses major.minor.patch", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseVersion("v0.4.0")).toEqual({ major: 0, minor: 4, patch: 0 });
  });

  it("throws on garbage", () => {
    expect(() => parseVersion("nope")).toThrow();
  });
});

describe("satisfies", () => {
  it("treats * and empty as any", () => {
    expect(satisfies("1.2.3", "*")).toBe(true);
    expect(satisfies("9.9.9", "")).toBe(true);
  });

  it("matches exact versions", () => {
    expect(satisfies("1.0.0", "1.0.0")).toBe(true);
    expect(satisfies("1.0.1", "1.0.0")).toBe(false);
  });

  it("handles caret ranges", () => {
    expect(satisfies("1.2.0", "^1.0.0")).toBe(true);
    expect(satisfies("1.0.0", "^1.2.0")).toBe(false);
    expect(satisfies("2.0.0", "^1.0.0")).toBe(false);
    // caret on 0.x is locked to the minor
    expect(satisfies("0.4.5", "^0.4.0")).toBe(true);
    expect(satisfies("0.5.0", "^0.4.0")).toBe(false);
  });

  it("handles tilde ranges", () => {
    expect(satisfies("1.2.9", "~1.2.0")).toBe(true);
    expect(satisfies("1.3.0", "~1.2.0")).toBe(false);
  });
});
