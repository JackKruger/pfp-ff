import type { LaunchContext } from "@pfp/sdk";
import type { InputFrame, PlayerInput } from "./game.js";

/**
 * Minimal slice of `@pfp/controls`' `ControlClient` that this reader needs.
 * Keeping it narrow makes the reader trivial to unit-test with a fake.
 */
export interface ForwardedSource {
  getLatestFrame(): { seq: number } | null;
  axis(slot: number, action: string): number;
  isPressed(slot: number, action: string): boolean;
  justPressed(slot: number, action: string): boolean;
}

/**
 * Reads Space Invaders input from shell-forwarded control frames instead of the
 * Gamepad API. Players are matched by `slot` (not array position), so a variable
 * 1–4 player roster maps correctly.
 *
 * `move` and `shoot` are continuous (held). `start` is a global edge — true on a
 * fresh frame if any player taps Start — and only surfaces on a new `seq` so a
 * single press isn't double-counted across animation frames.
 */
export class ForwardedInputReader {
  private lastSeq = -1;

  constructor(private readonly source: ForwardedSource) {}

  /** Returns the current frame, or `null` if no control frame has arrived yet. */
  sample(players: LaunchContext["players"]): InputFrame | null {
    const frame = this.source.getLatestFrame();
    if (!frame) return null;
    const fresh = frame.seq !== this.lastSeq;
    this.lastSeq = frame.seq;

    const inputs: PlayerInput[] = players.map((player) => this.readPlayer(player.slot));
    const anyStart =
      fresh && players.some((player) => this.source.justPressed(player.slot, "start"));

    return { inputs, anyStart };
  }

  private readPlayer(slot: number): PlayerInput {
    const raw = this.source.axis(slot, "move");
    const axis = raw < -1 ? -1 : raw > 1 ? 1 : raw;
    return {
      axis,
      shoot: this.source.isPressed(slot, "shoot"),
      start: false,
      back: false,
    };
  }
}
