import {
  type DigitalButton,
  type GamepadState,
  neutralButtons,
} from "@pfp/input";
import type { ControlPoller } from "./frame.js";

/**
 * Maps physical keys (`KeyboardEvent.code`) to one player slot's normalized
 * buttons. Movement keys also drive the left stick axes, so a game can bind
 * either `leftStickX`/`leftStickY` or `dpadX`/`dpadY` and keyboard still works.
 */
export interface KeyboardSlotLayout {
  up: string;
  down: string;
  left: string;
  right: string;
  a: string;
  b?: string;
  x?: string;
  y?: string;
  start?: string;
  back?: string;
}

/**
 * Sensible dev defaults for two keyboard players. P1 is WASD + Space/Enter, P2
 * is the arrow cluster + numpad. Couch play uses controllers; this exists so a
 * `forwarded`/`hybrid` game stays playable in dev without a gamepad.
 */
export const DEFAULT_KEYBOARD_LAYOUTS: Record<number, KeyboardSlotLayout> = {
  0: {
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    a: "Space",
    b: "ShiftLeft",
    x: "KeyQ",
    y: "KeyE",
    start: "Enter",
    back: "Escape",
  },
  1: {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    a: "Numpad0",
    b: "NumpadDecimal",
    start: "NumpadEnter",
    back: "Backspace",
  },
};

/**
 * A keyboard-backed {@link ControlPoller} keyed by player *slot* (not gamepad
 * index). The control-frame builder falls back to this for any slot whose
 * gamepad is disconnected, so it never fights a real controller.
 *
 * Call {@link attach} once to listen for key events and {@link tick} once per
 * frame (the forwarder does this) so edge detection has a previous snapshot.
 * The pure key-state core ({@link set}) is DOM-free for testing.
 */
export class KeyboardControlSource implements ControlPoller {
  private readonly held = new Set<string>();
  private readonly layouts: Map<number, KeyboardSlotLayout>;
  private readonly mappedCodes: Set<string>;
  private current = new Map<number, GamepadState>();
  private previous = new Map<number, GamepadState>();
  private detach: (() => void) | null = null;

  constructor(layouts: Record<number, KeyboardSlotLayout> = DEFAULT_KEYBOARD_LAYOUTS) {
    this.layouts = new Map(Object.entries(layouts).map(([slot, l]) => [Number(slot), l]));
    this.mappedCodes = new Set();
    for (const layout of this.layouts.values()) {
      for (const code of Object.values(layout)) if (code) this.mappedCodes.add(code);
    }
    this.tick(); // seed neutral current/previous so getState works pre-attach
  }

  /** Begin listening for key events on `target` (defaults to `window`). */
  attach(target: Pick<Window, "addEventListener" | "removeEventListener"> = window): void {
    if (this.detach) return;
    const onDown = (e: Event) => {
      const code = (e as KeyboardEvent).code;
      if (!this.mappedCodes.has(code)) return;
      e.preventDefault();
      this.set(code, true);
    };
    const onUp = (e: Event) => this.set((e as KeyboardEvent).code, false);
    target.addEventListener("keydown", onDown);
    target.addEventListener("keyup", onUp);
    this.detach = () => {
      target.removeEventListener("keydown", onDown);
      target.removeEventListener("keyup", onUp);
    };
  }

  dispose(): void {
    this.detach?.();
    this.detach = null;
    this.held.clear();
  }

  /** Set a physical key's held state. Public so tests can drive it DOM-free. */
  set(code: string, down: boolean): void {
    if (down) this.held.add(code);
    else this.held.delete(code);
  }

  /** Roll current → previous and rebuild each slot's state from held keys. */
  tick(): void {
    this.previous = this.current;
    const next = new Map<number, GamepadState>();
    for (const [slot, layout] of this.layouts) next.set(slot, this.buildState(slot, layout));
    this.current = next;
  }

  getState(slot: number): GamepadState | null {
    return this.current.get(slot) ?? null;
  }

  pressed(slot: number, button: DigitalButton): boolean {
    return this.current.get(slot)?.buttons[button] ?? false;
  }

  justPressed(slot: number, button: DigitalButton): boolean {
    const now = this.current.get(slot)?.buttons[button] ?? false;
    const before = this.previous.get(slot)?.buttons[button] ?? false;
    return now && !before;
  }

  justReleased(slot: number, button: DigitalButton): boolean {
    const now = this.current.get(slot)?.buttons[button] ?? false;
    const before = this.previous.get(slot)?.buttons[button] ?? false;
    return before && !now;
  }

  trigger(): number {
    return 0; // keyboard has no analog triggers
  }

  private buildState(slot: number, layout: KeyboardSlotLayout): GamepadState {
    const down = (code?: string): boolean => code != null && this.held.has(code);
    const buttons = neutralButtons();
    buttons.up = down(layout.up);
    buttons.down = down(layout.down);
    buttons.left = down(layout.left);
    buttons.right = down(layout.right);
    buttons.a = down(layout.a);
    buttons.b = down(layout.b);
    buttons.x = down(layout.x);
    buttons.y = down(layout.y);
    buttons.start = down(layout.start);
    buttons.back = down(layout.back);

    return {
      index: slot,
      connected: true,
      buttons,
      axes: {
        lx: (buttons.right ? 1 : 0) - (buttons.left ? 1 : 0),
        ly: (buttons.down ? 1 : 0) - (buttons.up ? 1 : 0),
        rx: 0,
        ry: 0,
      },
    };
  }
}
