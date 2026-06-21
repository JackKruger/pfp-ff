/**
 * Mock harness — exercise the full protocol without real iframes. Used by tests
 * and (later) a dev page so the shell host can be developed before any real game
 * exists, and games can be developed against a fake host. See §12, Phase 1.
 */
import { createGameClient, type GameClient } from "./client.js";
import { createGameHost, type GameHost, type GameHostOptions } from "./host.js";
import { createLinkedTransports } from "./transport.js";
import type { GameResult, LaunchContext } from "./types.js";

export interface LinkedPair {
  host: GameHost;
  client: GameClient;
  dispose(): void;
}

/** A host and client wired together in-memory, ready to handshake. */
export function createLinkedHostAndClient(options: GameHostOptions = {}): LinkedPair {
  const [hostTransport, clientTransport] = createLinkedTransports();
  const host = createGameHost(hostTransport, options);
  const client = createGameClient(clientTransport);
  return {
    host,
    client,
    dispose() {
      host.dispose();
      client.dispose();
    },
  };
}

/**
 * A trivial "game" for harness/dev use: on launch it immediately ends, ranking
 * players by slot order (P1 wins) and emitting a token score. Replace with a
 * real game; this just proves the loop end to end.
 */
export function attachMockGame(
  client: GameClient,
  options: { buildResult?: (context: LaunchContext) => GameResult } = {},
): void {
  client.onLaunch((context) => {
    const result = options.buildResult?.(context) ?? defaultResult(context);
    client.gameOver(result);
  });
  client.ready();
}

function defaultResult(context: LaunchContext): GameResult {
  const now = Date.now();
  return {
    gameId: "mock",
    sessionId: context.sessionId,
    startedAt: now,
    endedAt: now,
    standings: context.players.map((player, index) => ({
      slot: player.slot,
      profileId: player.profileId,
      rank: index + 1,
      score: context.players.length - index,
    })),
  };
}
