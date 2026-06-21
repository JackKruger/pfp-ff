import { createGameClient } from "@pfp/sdk";
import type { GameClient, LaunchContext } from "@pfp/sdk";
import { BrowserActionSource } from "./inputSource.js";
import type { ChallengeRuntime } from "./systems/challenges.js";
import type { GrandPrixState } from "./systems/playlist.js";
import type { RankedPlayer, RaskullsMode } from "./systems/types.js";

export interface CompletedMatch {
  mode: RaskullsMode;
  levelName?: string;
  grandPrixFinal?: boolean;
  startedAt: number;
  endedAt: number;
  ranked: RankedPlayer[];
}

export interface RaskullsSession {
  client: GameClient;
  input: BrowserActionSource;
  context: LaunchContext | null;
  completed: CompletedMatch | null;
  challenge: ChallengeRuntime | null;
  grandPrix: GrandPrixState | null;
  onLaunch(callback: (context: LaunchContext) => void): () => void;
}

export const session = createRaskullsSession();

function createRaskullsSession(): RaskullsSession {
  const client = createGameClient();
  const input = new BrowserActionSource();
  const launchHandlers = new Set<(context: LaunchContext) => void>();
  const state: RaskullsSession = {
    client,
    input,
    context: null,
    completed: null,
    challenge: null,
    grandPrix: null,
    onLaunch(callback) {
      launchHandlers.add(callback);
      if (state.context) callback(state.context);
      return () => launchHandlers.delete(callback);
    },
  };

  client.onLaunch((context) => {
    state.context = context;
    for (const handler of launchHandlers) handler(context);
  });

  client.onTerminate(() => {
    input.dispose();
    client.dispose();
  });

  return state;
}
