import { describe, expect, it } from "vitest";
import { neutralGamepadState } from "@pfp/input";
import { KEYBOARD_MAPPINGS, normalizeActions } from "../src/systems/input.js";

describe("raskulls input", () => {
  it("normalizes keyboard movement and edges", () => {
    const actions = normalizeActions({
      gamepad: null,
      previousGamepad: null,
      keys: new Set(["KeyD", "Space"]),
      previousKeys: new Set(["KeyD"]),
      mapping: KEYBOARD_MAPPINGS[0]!,
    });

    expect(actions.moveX).toBe(1);
    expect(actions.jump).toBe(true);
    expect(actions.justJump).toBe(true);
    expect(actions.justDig).toBe(false);
  });

  it("normalizes gamepad axes, dpad, and action buttons", () => {
    const previous = neutralGamepadState(0);
    const current = neutralGamepadState(0);
    current.axes.lx = -0.7;
    current.buttons.right = true;
    current.buttons.x = true;
    current.buttons.start = true;

    const actions = normalizeActions({
      gamepad: current,
      previousGamepad: previous,
      keys: new Set(),
      previousKeys: new Set(),
      mapping: KEYBOARD_MAPPINGS[0]!,
    });

    expect(actions.moveX).toBeCloseTo(0.3);
    expect(actions.dig).toBe(true);
    expect(actions.justDig).toBe(true);
    expect(actions.justStart).toBe(true);
  });
});
