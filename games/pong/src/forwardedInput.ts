import type { PlayerInput } from "./game.js";
import type { InputFrame } from "./input.js";

/**
 * Minimal slice of `@pfp/controls`' `ControlClient` that this reader needs.
 * Keeping it narrow makes the reader trivial to unit-test with a fake.
 */
export interface ForwardedSource {
  getLatestFrame(): { seq: number } | null;
  axis(slot: number, action: string): number;
  justPressed(slot: number, action: string): boolean;
}

/**
 * Reads Pong paddle input from shell-forwarded control frames instead of the
 * Gamepad API. P1 is slot 0, P2 is slot 1, matching the launch order.
 *
 * `start`/`back` are edge-triggered and only surface on a *fresh* frame (a new
 * `seq`), so a single shell-produced press isn't double-counted when the game
 * loop reads the same cached frame across multiple animation frames.
 */
export class ForwardedInputReader {
  private lastSeq = -1;

  constructor(private readonly source: ForwardedSource) {}

  /** Returns the current frame, or `null` if no control frame has arrived yet. */
  sample(): InputFrame | null {
    const frame = this.source.getLatestFrame();
    if (!frame) return null;
    const fresh = frame.seq !== this.lastSeq;
    this.lastSeq = frame.seq;
    return {
      p1: this.readPlayer(0, fresh),
      p2: this.readPlayer(1, fresh),
    };
  }

  private readPlayer(slot: number, fresh: boolean): PlayerInput {
    const raw = this.source.axis(slot, "paddle");
    const axis = raw < -1 ? -1 : raw > 1 ? 1 : raw;
    return {
      axis,
      start: fresh && this.source.justPressed(slot, "start"),
      back: fresh && this.source.justPressed(slot, "back"),
    };
  }
}
