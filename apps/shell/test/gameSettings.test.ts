import { describe, expect, it } from "vitest";
import { defaultSettingsFor, setGameSetting, validateSettingsFor } from "../src/gameSettings.js";
import type { GameManifest } from "@pfp/sdk";

describe("game settings", () => {
  it("builds defaults for all setting field types", () => {
    expect(defaultSettingsFor(gameWithSettings())).toEqual({
      bots: true,
      scoreToWin: 3,
      arena: "small",
    });
  });

  it("validates and normalizes missing settings to defaults", () => {
    expect(validateSettingsFor(gameWithSettings(), { bots: false })).toEqual({
      ok: true,
      value: {
        bots: false,
        scoreToWin: 3,
        arena: "small",
      },
    });
  });

  it("rejects unknown, out-of-range, and invalid choice values", () => {
    const result = validateSettingsFor(gameWithSettings(), {
      bots: true,
      scoreToWin: 99,
      arena: "huge",
      spare: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        'Unknown setting "spare"',
        'Setting "scoreToWin" must be between 1 and 10',
        'Setting "arena" must be one of its declared choices',
      ]);
    }
  });

  it("updates a single setting only when the value is valid", () => {
    const game = gameWithSettings();
    const defaults = defaultSettingsFor(game);

    expect(setGameSetting(game, defaults, "scoreToWin", 5)).toEqual({
      bots: true,
      scoreToWin: 5,
      arena: "small",
    });
    expect(setGameSetting(game, defaults, "scoreToWin", 99)).toBe(defaults);
    expect(setGameSetting(game, defaults, "unknown", 1)).toBe(defaults);
  });
});

function gameWithSettings(): Pick<GameManifest, "settings"> {
  return {
    settings: {
      fields: [
        { id: "bots", label: "Bots", type: "boolean", default: true },
        {
          id: "scoreToWin",
          label: "Score to win",
          type: "number",
          min: 1,
          max: 10,
          step: 1,
          default: 3,
        },
        {
          id: "arena",
          label: "Arena",
          type: "choice",
          options: [
            { value: "small", label: "Small" },
            { value: "large", label: "Large" },
          ],
          default: "small",
        },
      ],
    },
  };
}
