import { describe, expect, it, vi } from "vitest";
import {
  SDK_VERSION,
  attachMockGame,
  createLinkedHostAndClient,
  type GameResult,
  type LaunchContext,
} from "../src/index.js";

function launchContext(): LaunchContext {
  return {
    sessionId: "session-1",
    sdkVersion: SDK_VERSION,
    settings: {},
    players: [
      { slot: 0, profileId: "p1", displayName: "Ann", color: "#f00", gamepadIndex: 0 },
      { slot: 1, profileId: "p2", displayName: "Bob", color: "#00f", gamepadIndex: 1 },
    ],
  };
}

describe("game contract handshake", () => {
  it("completes ready -> launch -> gameOver", async () => {
    const pair = createLinkedHostAndClient();
    const ctx = launchContext();

    let launched: LaunchContext | undefined;
    pair.client.onLaunch((c) => {
      launched = c;
      pair.client.gameOver({
        gameId: "test",
        sessionId: c.sessionId,
        startedAt: 0,
        endedAt: 100,
        standings: [
          { slot: 0, profileId: "p1", rank: 1, score: 11 },
          { slot: 1, profileId: "p2", rank: 2, score: 7 },
        ],
      });
    });

    const result = await new Promise<GameResult>((resolve) => {
      pair.host.onReady(() => pair.host.launch(ctx));
      pair.host.onGameOver(resolve);
      pair.client.ready();
    });

    expect(launched?.sessionId).toBe("session-1");
    expect(launched?.players).toHaveLength(2);
    expect(result.standings[0]).toMatchObject({ slot: 0, rank: 1, score: 11 });
    pair.dispose();
  });

  it("drives the bundled mock game to a result", async () => {
    const pair = createLinkedHostAndClient();

    const result = await new Promise<GameResult>((resolve) => {
      pair.host.onReady(() => pair.host.launch(launchContext()));
      pair.host.onGameOver(resolve);
      attachMockGame(pair.client);
    });

    expect(result.standings).toHaveLength(2);
    expect(result.standings[0].rank).toBe(1);
    pair.dispose();
  });

  it("relays pause, resume, terminate and request-exit", async () => {
    const pair = createLinkedHostAndClient();
    const onPause = vi.fn();
    const onResume = vi.fn();
    const onTerminate = vi.fn();
    const onExit = vi.fn();

    pair.client.onPause(onPause);
    pair.client.onResume(onResume);
    pair.client.onTerminate(onTerminate);
    pair.host.onRequestExit(onExit);

    pair.host.pause();
    pair.host.resume();
    pair.host.terminate();
    pair.client.requestExit();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onPause).toHaveBeenCalledOnce();
    expect(onResume).toHaveBeenCalledOnce();
    expect(onTerminate).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
    pair.dispose();
  });

  it("flags an incompatible SDK range on ready", async () => {
    const pair = createLinkedHostAndClient({ sdkRange: "^2.0.0" });
    const onIncompatible = vi.fn();

    await new Promise<void>((resolve) => {
      pair.host.onIncompatible((info) => {
        onIncompatible(info);
        resolve();
      });
      pair.client.ready();
    });

    expect(onIncompatible).toHaveBeenCalledWith({
      gameSdkRange: "^2.0.0",
      hostVersion: SDK_VERSION,
    });
    pair.dispose();
  });
});
