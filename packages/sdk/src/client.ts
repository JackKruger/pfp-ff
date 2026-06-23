/**
 * Game-side client. A game imports this, registers lifecycle handlers, and calls
 * `ready()` once loaded. The shell replies with `launch(ctx)`; the game plays and
 * reports back via `gameOver(result)`. See docs/ARCHITECTURE.md §5.3.
 */
import { Emitter } from "./emitter.js";
import { GameToShell, ShellToGame, makeEnvelope, type Envelope } from "./protocol.js";
import { createParentTransport, type Transport } from "./transport.js";
import type { ControlFrame, GameResult, LaunchContext } from "./types.js";
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
  onInputFrame(callback: (frame: ControlFrame) => void): () => void;

  dispose(): void;
}

/**
 * @param transport defaults to talking to the parent window (the real iframe
 * case). Pass a linked transport for tests / the mock harness.
 */
export function createGameClient(transport: Transport = createParentTransport()): GameClient {
  const launch = new Emitter<[LaunchContext]>();
  const pause = new Emitter();
  const resume = new Emitter();
  const terminate = new Emitter();
  const inputFrame = new Emitter<[ControlFrame]>();

  const unsubscribe = transport.subscribe((message: Envelope) => {
    switch (message.type) {
      case ShellToGame.LAUNCH:
        launch.emit(message.payload);
        break;
      case ShellToGame.PAUSE:
        pause.emit();
        break;
      case ShellToGame.RESUME:
        resume.emit();
        break;
      case ShellToGame.TERMINATE:
        terminate.emit();
        break;
      case ShellToGame.INPUT_FRAME:
        inputFrame.emit(message.payload);
        break;
    }
  });

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
    onLaunch: (callback) => launch.add(callback),
    onPause: (callback) => pause.add(callback),
    onResume: (callback) => resume.add(callback),
    onTerminate: (callback) => terminate.add(callback),
    onInputFrame: (callback) => inputFrame.add(callback),
    dispose() {
      unsubscribe();
      launch.clear();
      pause.clear();
      resume.clear();
      terminate.clear();
      inputFrame.clear();
      transport.dispose();
    },
  };
}
