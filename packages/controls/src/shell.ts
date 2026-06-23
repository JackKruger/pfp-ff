import type { GameHost, PlayerSlot } from "@pfp/sdk";
import { createControlFrame, type ControlPoller } from "./frame.js";
import type { ControlSchema } from "./schema.js";

/**
 * Slot-keyed fallback source that the forwarder advances and tears down. A
 * {@link KeyboardControlSource} satisfies this; it must be ticked each frame so
 * its edge detection has a previous snapshot.
 */
export interface ForwarderKeyboard extends ControlPoller {
  tick(): void;
  dispose(): void;
}

export interface ControlForwarderOptions {
  host: Pick<GameHost, "sendInputFrame">;
  poller: ControlPoller;
  players: readonly PlayerSlot[];
  schema?: ControlSchema;
  /** Optional keyboard fallback for slots whose gamepad is disconnected. */
  keyboard?: ForwarderKeyboard;
  clock?: () => number;
  maxDtMs?: number;
}

export interface ControlForwarder {
  sendFrame(): void;
  setPaused(paused: boolean): void;
  updatePlayers(players: readonly PlayerSlot[]): void;
  dispose(): void;
}

export function createControlForwarder(options: ControlForwarderOptions): ControlForwarder {
  const clock = options.clock ?? Date.now;
  const maxDtMs = options.maxDtMs ?? 100;
  let players = [...options.players];
  let paused = false;
  let seq = 0;
  let lastNow = clock();
  let disposed = false;

  return {
    sendFrame() {
      if (disposed) return;
      const now = clock();
      const dtMs = Math.min(Math.max(0, now - lastNow), maxDtMs);
      lastNow = now;
      options.keyboard?.tick();
      options.host.sendInputFrame(
        createControlFrame({
          seq: ++seq,
          now,
          dtMs,
          paused,
          players,
          poller: options.poller,
          keyboard: options.keyboard,
          schema: options.schema,
        }),
      );
    },
    setPaused(nextPaused) {
      paused = nextPaused;
      lastNow = clock();
    },
    updatePlayers(nextPlayers) {
      players = [...nextPlayers];
    },
    dispose() {
      disposed = true;
      options.keyboard?.dispose();
    },
  };
}
