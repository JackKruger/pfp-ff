import { describe, expect, it } from "vitest";
import { hazardEffectForMode } from "../src/systems/hazards.js";

describe("raskulls hazards", () => {
  it("uses non-lethal setback hazards in race mode", () => {
    expect(hazardEffectForMode("race")).toMatchObject({
      lethal: false,
      clearPowerup: true,
    });
    expect(hazardEffectForMode("race").frenzyDrain).toBeGreaterThan(0);
    expect(hazardEffectForMode("race").bounceY).toBeGreaterThan(0);
  });

  it("keeps lethal hazards for arena mode", () => {
    expect(hazardEffectForMode("arena")).toMatchObject({
      lethal: true,
      clearPowerup: false,
      frenzyDrain: 0,
    });
  });
});
