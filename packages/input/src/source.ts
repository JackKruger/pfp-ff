/**
 * A GamepadSource yields the current normalized state of every controller slot.
 * Abstracting it lets the poller run identically against the real Gamepad API
 * (browser) or synthetic snapshots (tests / dev harness).
 */
import { normalizeGamepad } from "./normalize.js";
import type { GamepadState } from "./types.js";

export interface GamepadSource {
  /** Indexed by gamepad index; null where no controller occupies that slot. */
  read(): (GamepadState | null)[];
}

/** Reads live controllers via navigator.getGamepads(). */
export class BrowserGamepadSource implements GamepadSource {
  constructor(private readonly deadzone?: number) {}

  read(): (GamepadState | null)[] {
    const pads = navigator.getGamepads?.() ?? [];
    return Array.from(pads, (pad) => (pad ? normalizeGamepad(pad, this.deadzone) : null));
  }
}

/** Test/dev source whose states are set explicitly. */
export class ManualGamepadSource implements GamepadSource {
  private states: (GamepadState | null)[] = [];

  read(): (GamepadState | null)[] {
    // Return a fresh array each read: the poller keeps the previous read for edge
    // detection, so handing back the live array (mutated via set()) would make
    // previous and current alias and silently break justPressed/justReleased.
    return [...this.states];
  }

  setStates(states: (GamepadState | null)[]): void {
    this.states = states;
  }

  set(index: number, state: GamepadState | null): void {
    this.states[index] = state;
  }
}
