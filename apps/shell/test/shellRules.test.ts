import { describe, expect, it } from "vitest";
import { BUILT_GAME_IDS } from "../src/buildGames.js";
import { GAME_MANIFESTS } from "../src/games.generated.js";
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

  it("maps every generated manifest into a shell game entry", () => {
    expect(GAMES.map((game) => game.id).sort()).toEqual(
      GAME_MANIFESTS.map((game) => game.id).sort(),
    );
  });

  it("requires enabled games to declare thumbnails and production entries", () => {
    for (const manifest of GAME_MANIFESTS) {
      if (manifest.presentation?.disabled) continue;

      expect(manifest.thumbnail, `${manifest.id} thumbnail`).toBeTruthy();
      expect(manifest.entry, `${manifest.id} entry`).toBe(`/games/${manifest.id}/index.html`);
    }
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

  it("promotes proved simple games to forwarded-only shell input", () => {
    const inputModeById = new Map(GAME_MANIFESTS.map((game) => [game.id, game.input?.mode]));

    expect(inputModeById.get("pong")).toBe("forwarded");
    expect(inputModeById.get("space-invaders")).toBe("forwarded");
  });
});
