import { describe, expect, it } from "vitest";
import { BUILT_GAME_IDS } from "../src/buildGames.js";
import { GAMES } from "../src/games.js";
import { canStartGame, playableGamesMissingBuild } from "../src/shellRules.js";

describe("shell rules", () => {
  it("requires the selected game's minimum player count before starting", () => {
    expect(canStartGame(1, 1)).toBe(true);
    expect(canStartGame(1, 2)).toBe(false);
    expect(canStartGame(2, 2)).toBe(true);
  });

  it("does not expose playable games missing from the production copy list", () => {
    expect(playableGamesMissingBuild(GAMES, BUILT_GAME_IDS)).toEqual([]);
  });
});
