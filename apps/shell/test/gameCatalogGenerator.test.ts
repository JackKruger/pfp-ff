import { describe, expect, it } from "vitest";
import {
  catalogGameDirs,
  identifierForGameDir,
  renderCatalog,
} from "../../../scripts/generate-game-catalog.mjs";

describe("game catalog generator", () => {
  it("sorts game directories and skips templates", () => {
    expect(catalogGameDirs(["pong", "_template-sdk", "raskulls", "space-invaders"])).toEqual([
      "pong",
      "raskulls",
      "space-invaders",
    ]);
  });

  it("creates safe import identifiers from game directory names", () => {
    expect(identifierForGameDir("space-invaders")).toBe("spaceInvaders");
    expect(identifierForGameDir("2048")).toBe("game2048");
  });

  it("renders a generated manifest catalog", () => {
    expect(
      renderCatalog([
        { dir: "pong", identifier: "pong" },
        { dir: "space-invaders", identifier: "spaceInvaders" },
      ]),
    ).toContain('import spaceInvaders from "../../../games/space-invaders/game.manifest.js";');
  });
});
