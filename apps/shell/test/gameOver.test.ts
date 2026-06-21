import { describe, expect, it, vi } from "vitest";
import type { GameResult } from "@pfp/sdk";
import { recordMatchBestEffort } from "../src/gameOver.js";

describe("game over handling", () => {
  it("records matches when persistence succeeds", async () => {
    const result = gameResult();
    const recordMatch = vi.fn(async (_result: GameResult) => {});
    const onError = vi.fn();

    await recordMatchBestEffort(result, recordMatch, onError);

    expect(recordMatch).toHaveBeenCalledWith(result);
    expect(onError).not.toHaveBeenCalled();
  });

  it("swallows persistence failures so results navigation can continue", async () => {
    const error = new Error("indexeddb unavailable");
    const recordMatch = vi.fn(async (_result: GameResult) => {
      throw error;
    });
    const onError = vi.fn();

    await expect(
      recordMatchBestEffort(gameResult(), recordMatch, onError),
    ).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(error);
  });
});

function gameResult(): GameResult {
  return {
    gameId: "pong",
    sessionId: "session-1",
    startedAt: 1,
    endedAt: 2,
    standings: [{ slot: 0, profileId: null, rank: 1 }],
  };
}
