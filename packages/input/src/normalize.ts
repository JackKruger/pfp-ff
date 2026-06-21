/**
 * Convert a raw Gamepad (W3C "standard" mapping) into our normalized
 * GamepadState. This is the single chokepoint for controller-layout quirks.
 *
 * Standard mapping reference:
 *   buttons: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back, 9 Start,
 *            10 L3, 11 R3, 12 DPadUp, 13 DPadDown, 14 DPadLeft, 15 DPadRight,
 *            16 Guide
 *   axes:    0 LX, 1 LY, 2 RX, 3 RY
 */
import { type GamepadState, neutralButtons } from "./types.js";

export const DEFAULT_DEADZONE = 0.15;

function pressed(pad: Gamepad, i: number): boolean {
  return pad.buttons[i]?.pressed ?? false;
}

function value(pad: Gamepad, i: number): number {
  return pad.buttons[i]?.value ?? 0;
}

function deadzone(v: number, dz: number): number {
  return Math.abs(v) < dz ? 0 : v;
}

export function normalizeGamepad(pad: Gamepad, deadzoneValue = DEFAULT_DEADZONE): GamepadState {
  const buttons = neutralButtons();
  buttons.a = pressed(pad, 0);
  buttons.b = pressed(pad, 1);
  buttons.x = pressed(pad, 2);
  buttons.y = pressed(pad, 3);
  buttons.lb = pressed(pad, 4);
  buttons.rb = pressed(pad, 5);
  buttons.lt = value(pad, 6);
  buttons.rt = value(pad, 7);
  buttons.back = pressed(pad, 8);
  buttons.start = pressed(pad, 9);
  buttons.l3 = pressed(pad, 10);
  buttons.r3 = pressed(pad, 11);
  buttons.up = pressed(pad, 12);
  buttons.down = pressed(pad, 13);
  buttons.left = pressed(pad, 14);
  buttons.right = pressed(pad, 15);
  buttons.guide = pressed(pad, 16);

  return {
    index: pad.index,
    connected: pad.connected,
    buttons,
    axes: {
      lx: deadzone(pad.axes[0] ?? 0, deadzoneValue),
      ly: deadzone(pad.axes[1] ?? 0, deadzoneValue),
      rx: deadzone(pad.axes[2] ?? 0, deadzoneValue),
      ry: deadzone(pad.axes[3] ?? 0, deadzoneValue),
    },
  };
}
