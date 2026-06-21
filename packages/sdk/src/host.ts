/**
 * Shell-side host. The shell creates one per launched game, wires it to the
 * game's iframe, and drives the lifecycle: wait for `ready`, send `launch`,
 * handle `gameOver` / `requestExit` / `error`. See docs/ARCHITECTURE.md §5.3.
 */
import { Emitter } from "./emitter.js";
import { GameToShell, ShellToGame, makeEnvelope, type Envelope } from "./protocol.js";
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
  onIncompatible(
    callback: (info: { gameSdkRange: string; hostVersion: string }) => void,
  ): () => void;

  dispose(): void;
}

export function createGameHost(transport: Transport, options: GameHostOptions = {}): GameHost {
  const ready = new Emitter<[{ sdkVersion: string }]>();
  const gameOver = new Emitter<[GameResult]>();
  const requestExit = new Emitter();
  const error = new Emitter<[{ message: string }]>();
  const incompatible = new Emitter<[{ gameSdkRange: string; hostVersion: string }]>();

  const unsubscribe = transport.subscribe((message: Envelope) => {
    switch (message.type) {
      case GameToShell.READY: {
        if (options.sdkRange && !satisfies(SDK_VERSION, options.sdkRange)) {
          incompatible.emit({ gameSdkRange: options.sdkRange, hostVersion: SDK_VERSION });
        }
        ready.emit(message.payload);
        break;
      }
      case GameToShell.GAME_OVER:
        gameOver.emit(message.payload);
        break;
      case GameToShell.REQUEST_EXIT:
        requestExit.emit();
        break;
      case GameToShell.ERROR:
        error.emit(message.payload);
        break;
    }
  });

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
    onReady: (callback) => ready.add(callback),
    onGameOver: (callback) => gameOver.add(callback),
    onRequestExit: (callback) => requestExit.add(callback),
    onError: (callback) => error.add(callback),
    onIncompatible: (callback) => incompatible.add(callback),
    dispose() {
      unsubscribe();
      ready.clear();
      gameOver.clear();
      requestExit.clear();
      error.clear();
      incompatible.clear();
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
