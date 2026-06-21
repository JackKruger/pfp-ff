/**
 * Normalized controller model. The whole app reads this Xbox-layout scheme
 * rather than raw Gamepad API indices, so button mapping quirks are handled in
 * exactly one place (normalize.ts). See docs/ARCHITECTURE.md §6.
 */

/** Digital (on/off) buttons. Triggers are analog and live in GamepadButtons. */
export const DIGITAL_BUTTONS = [
  "a",
  "b",
  "x",
  "y",
  "lb",
  "rb",
  "l3",
  "r3",
  "start",
  "back",
  "guide",
  "up",
  "down",
  "left",
  "right",
] as const;

export type DigitalButton = (typeof DIGITAL_BUTTONS)[number];

export interface GamepadButtons extends Record<DigitalButton, boolean> {
  /** Left trigger, 0..1 analog. */
  lt: number;
  /** Right trigger, 0..1 analog. */
  rt: number;
}

export interface GamepadAxes {
  /** Left stick X/Y, deadzoned, -1..1. */
  lx: number;
  ly: number;
  /** Right stick X/Y, deadzoned, -1..1. */
  rx: number;
  ry: number;
}

export interface GamepadState {
  /** Index into navigator.getGamepads(). */
  index: number;
  connected: boolean;
  buttons: GamepadButtons;
  axes: GamepadAxes;
}

export function neutralButtons(): GamepadButtons {
  return {
    a: false,
    b: false,
    x: false,
    y: false,
    lb: false,
    rb: false,
    l3: false,
    r3: false,
    start: false,
    back: false,
    guide: false,
    up: false,
    down: false,
    left: false,
    right: false,
    lt: 0,
    rt: 0,
  };
}

/** A fully-neutral connected state — handy for tests and as a base for merges. */
export function neutralGamepadState(index: number): GamepadState {
  return {
    index,
    connected: true,
    buttons: neutralButtons(),
    axes: { lx: 0, ly: 0, rx: 0, ry: 0 },
  };
}
