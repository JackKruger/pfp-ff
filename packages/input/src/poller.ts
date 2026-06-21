/**
 * InputPoller samples a GamepadSource each frame, retains the previous frame for
 * edge detection (justPressed/justReleased), and emits connect/disconnect
 * events. In the browser it self-drives via requestAnimationFrame; in tests you
 * call tick() manually. See docs/ARCHITECTURE.md §6.
 */
import { BrowserGamepadSource, type GamepadSource } from "./source.js";
import type { DigitalButton, GamepadState } from "./types.js";

export type ControllerListener = (index: number) => void;

/** The slice of the poller the pairing lobby needs — keeps the lobby testable. */
export interface PairingInput {
  connectedIndices(): number[];
  justPressed(index: number, button: DigitalButton): boolean;
}

export class InputPoller implements PairingInput {
  private current: (GamepadState | null)[] = [];
  private previous: (GamepadState | null)[] = [];
  private primed = false;
  private rafId: number | null = null;
  private readonly connectHandlers = new Set<ControllerListener>();
  private readonly disconnectHandlers = new Set<ControllerListener>();

  constructor(private readonly source: GamepadSource = new BrowserGamepadSource()) {}

  /** Sample one frame: rotate previous<-current, read fresh, fire connect events. */
  tick(): void {
    this.previous = this.current;
    this.current = this.source.read();
    this.detectConnectionChanges();
    if (!this.primed) {
      // First tick: suppress phantom button edges from controls that were already
      // held before polling began (e.g. A held as the lobby mounts -> no instant
      // join). Connect events for initially-present pads already fired above.
      this.previous = this.current;
      this.primed = true;
    }
  }

  /** Begin a requestAnimationFrame polling loop (browser only). */
  start(): void {
    if (this.rafId !== null) return;
    const loop = (): void => {
      this.tick();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  getState(index: number): GamepadState | null {
    return this.current[index] ?? null;
  }

  pressed(index: number, button: DigitalButton): boolean {
    return this.current[index]?.buttons[button] ?? false;
  }

  justPressed(index: number, button: DigitalButton): boolean {
    const now = this.current[index]?.buttons[button] ?? false;
    const before = this.previous[index]?.buttons[button] ?? false;
    return now && !before;
  }

  justReleased(index: number, button: DigitalButton): boolean {
    const now = this.current[index]?.buttons[button] ?? false;
    const before = this.previous[index]?.buttons[button] ?? false;
    return before && !now;
  }

  /** Analog trigger value (lt/rt), 0..1. */
  trigger(index: number, which: "lt" | "rt"): number {
    return this.current[index]?.buttons[which] ?? 0;
  }

  connectedIndices(): number[] {
    const out: number[] = [];
    this.current.forEach((state, index) => {
      if (state?.connected) out.push(index);
    });
    return out;
  }

  onConnect(listener: ControllerListener): () => void {
    this.connectHandlers.add(listener);
    return () => this.connectHandlers.delete(listener);
  }

  onDisconnect(listener: ControllerListener): () => void {
    this.disconnectHandlers.add(listener);
    return () => this.disconnectHandlers.delete(listener);
  }

  private detectConnectionChanges(): void {
    const wasConnected = (states: (GamepadState | null)[], index: number): boolean =>
      states[index]?.connected ?? false;

    const span = Math.max(this.current.length, this.previous.length);
    for (let index = 0; index < span; index++) {
      const now = wasConnected(this.current, index);
      const before = wasConnected(this.previous, index);
      if (now && !before) for (const h of this.connectHandlers) h(index);
      else if (!now && before) for (const h of this.disconnectHandlers) h(index);
    }
  }
}
