import { describe, expect, it } from "vitest";
import { BUILT_GAME_IDS } from "../src/buildGames.js";
import { GAMES } from "../src/games.js";
import {
  canStartGame,
  playableGamesMissingBuild,
  usesShellForwardedInput,
} from "../src/shellRules.js";

describe("shell rules", () => {
  it("requires the selected game's minimum player count before starting", () => {
    expect(canStartGame(1, 1)).toBe(true);
    expect(canStartGame(1, 2)).toBe(false);
    expect(canStartGame(2, 2)).toBe(true);
  });

  it("does not expose playable games missing from the production copy list", () => {
    expect(playableGamesMissingBuild(GAMES, BUILT_GAME_IDS)).toEqual([]);
  });

  it("keeps game ids unique", () => {
    const ids = GAMES.map((game) => game.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks enabled games as production-built in manifest metadata", () => {
    for (const game of GAMES) {
      if (!game.disabled) expect(game.build?.built).toBe(true);
    }
  });

  it("detects games that need shell-forwarded controls", () => {
    expect(usesShellForwardedInput({ input: { mode: "direct" } })).toBe(false);
    expect(usesShellForwardedInput({ input: { mode: "forwarded" } })).toBe(true);
    expect(usesShellForwardedInput({ input: { mode: "hybrid" } })).toBe(true);
    expect(usesShellForwardedInput({})).toBe(false);
  });
});
