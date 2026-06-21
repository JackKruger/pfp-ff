/**
 * Shell-side host. The shell creates one per launched game, wires it to the
 * game's iframe, and drives the lifecycle: wait for `ready`, send `launch`,
 * handle `gameOver` / `requestExit` / `error`. See docs/ARCHITECTURE.md §5.3.
 */
import {
  GameToShell,
  ShellToGame,
  makeEnvelope,
  type Envelope,
} from "./protocol.js";
import { createWindowTransport, type Transport } from "./transport.js";
import type { GameResult, LaunchContext } from "./types.js";
import { SDK_VERSION, satisfies } from "./version.js";

export interface GameHostOptions {
  /**
   * The contract range the game targets (manifest.sdk). If provided, the host
   * checks it against SDK_VERSION when the game reports `ready` and fires
   * `onIncompatible` on mismatch.
   */
  sdkRange?: string;
}

export interface GameHost {
  launch(context: LaunchContext): void;
  pause(): void;
  resume(): void;
  terminate(): void;

  onReady(callback: (info: { sdkVersion: string }) => void): () => void;
  onGameOver(callback: (result: GameResult) => void): () => void;
  onRequestExit(callback: () => void): () => void;
  onError(callback: (error: { message: string }) => void): () => void;
  /** Game's declared SDK range is incompatible with this host's SDK_VERSION. */
  onIncompatible(callback: (info: { gameSdkRange: string; hostVersion: string }) => void): () => void;

  dispose(): void;
}

export function createGameHost(transport: Transport, options: GameHostOptions = {}): GameHost {
  const readyHandlers = new Set<(info: { sdkVersion: string }) => void>();
  const gameOverHandlers = new Set<(result: GameResult) => void>();
  const requestExitHandlers = new Set<() => void>();
  const errorHandlers = new Set<(error: { message: string }) => void>();
  const incompatibleHandlers = new Set<
    (info: { gameSdkRange: string; hostVersion: string }) => void
  >();

  const unsubscribe = transport.subscribe((message: Envelope) => {
    switch (message.type) {
      case GameToShell.READY: {
        const info = message.payload;
        if (options.sdkRange && !satisfies(SDK_VERSION, options.sdkRange)) {
          for (const handler of incompatibleHandlers) {
            handler({ gameSdkRange: options.sdkRange, hostVersion: SDK_VERSION });
          }
        }
        for (const handler of readyHandlers) handler(info);
        break;
      }
      case GameToShell.GAME_OVER:
        for (const handler of gameOverHandlers) handler(message.payload);
        break;
      case GameToShell.REQUEST_EXIT:
        for (const handler of requestExitHandlers) handler();
        break;
      case GameToShell.ERROR:
        for (const handler of errorHandlers) handler(message.payload);
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
    launch(context) {
      transport.post(makeEnvelope(ShellToGame.LAUNCH, context));
    },
    pause() {
      transport.post(makeEnvelope(ShellToGame.PAUSE, undefined));
    },
    resume() {
      transport.post(makeEnvelope(ShellToGame.RESUME, undefined));
    },
    terminate() {
      transport.post(makeEnvelope(ShellToGame.TERMINATE, undefined));
    },
    onReady: register(readyHandlers),
    onGameOver: register(gameOverHandlers),
    onRequestExit: register(requestExitHandlers),
    onError: register(errorHandlers),
    onIncompatible: register(incompatibleHandlers),
    dispose() {
      unsubscribe();
      readyHandlers.clear();
      gameOverHandlers.clear();
      requestExitHandlers.clear();
      errorHandlers.clear();
      incompatibleHandlers.clear();
      transport.dispose();
    },
  };
}

/** Convenience: build a host wired to a game's iframe element. */
export function createIframeHost(
  iframe: HTMLIFrameElement,
  options: GameHostOptions & { targetOrigin?: string } = {},
): GameHost {
  const target = iframe.contentWindow;
  if (!target) throw new Error("iframe has no contentWindow (not yet in the DOM?)");
  const transport = createWindowTransport(target, { targetOrigin: options.targetOrigin });
  return createGameHost(transport, options);
}
