/**
 * Game-side client. A game imports this, registers lifecycle handlers, and calls
 * `ready()` once loaded. The shell replies with `launch(ctx)`; the game plays and
 * reports back via `gameOver(result)`. See docs/ARCHITECTURE.md §5.3.
 */
import { GameToShell, ShellToGame, makeEnvelope, type Envelope } from "./protocol.js";
import { createParentTransport, type Transport } from "./transport.js";
import type { GameResult, LaunchContext } from "./types.js";
import { SDK_VERSION } from "./version.js";

export interface GameClient {
  /** Announce the game has loaded and is ready to receive `launch`. */
  ready(): void;
  /** Report the final result; the shell records it and returns to the menu. */
  gameOver(result: GameResult): void;
  /** Ask the shell to quit back to the menu (player chose "quit"). */
  requestExit(): void;
  /** Report an unrecoverable error; the shell shows a fault screen. */
  reportError(message: string): void;

  onLaunch(callback: (context: LaunchContext) => void): () => void;
  onPause(callback: () => void): () => void;
  onResume(callback: () => void): () => void;
  onTerminate(callback: () => void): () => void;

  dispose(): void;
}

/**
 * @param transport defaults to talking to the parent window (the real iframe
 * case). Pass a linked transport for tests / the mock harness.
 */
export function createGameClient(transport: Transport = createParentTransport()): GameClient {
  const launchHandlers = new Set<(context: LaunchContext) => void>();
  const pauseHandlers = new Set<() => void>();
  const resumeHandlers = new Set<() => void>();
  const terminateHandlers = new Set<() => void>();

  const unsubscribe = transport.subscribe((message: Envelope) => {
    switch (message.type) {
      case ShellToGame.LAUNCH:
        for (const handler of launchHandlers) handler(message.payload);
        break;
      case ShellToGame.PAUSE:
        for (const handler of pauseHandlers) handler();
        break;
      case ShellToGame.RESUME:
        for (const handler of resumeHandlers) handler();
        break;
      case ShellToGame.TERMINATE:
        for (const handler of terminateHandlers) handler();
        break;
    }
  });

  const register =
    <T>(set: Set<T>) =>
    (callback: T): (() => void) => {
      set.add(callback);
      return () => set.delete(callback);
    };

  return {
    ready() {
      transport.post(makeEnvelope(GameToShell.READY, { sdkVersion: SDK_VERSION }));
    },
    gameOver(result) {
      transport.post(makeEnvelope(GameToShell.GAME_OVER, result));
    },
    requestExit() {
      transport.post(makeEnvelope(GameToShell.REQUEST_EXIT, undefined));
    },
    reportError(message) {
      transport.post(makeEnvelope(GameToShell.ERROR, { message }));
    },
    onLaunch: register(launchHandlers),
    onPause: register(pauseHandlers),
    onResume: register(resumeHandlers),
    onTerminate: register(terminateHandlers),
    dispose() {
      unsubscribe();
      launchHandlers.clear();
      pauseHandlers.clear();
      resumeHandlers.clear();
      terminateHandlers.clear();
      transport.dispose();
    },
  };
}
