import { describe, expect, it } from "vitest";
import { normalizeGamepad } from "../src/index.js";

/** Build a raw standard-mapping Gamepad with given pressed button indices. */
function rawPad(
  index: number,
  options: { pressed?: number[]; values?: Record<number, number>; axes?: number[] } = {},
): Gamepad {
  const pressedSet = new Set(options.pressed ?? []);
  const buttons = Array.from({ length: 17 }, (_, i) => ({
    pressed: pressedSet.has(i),
    touched: pressedSet.has(i),
    value: options.values?.[i] ?? (pressedSet.has(i) ? 1 : 0),
  }));
  return {
    index,
    id: "Xbox Controller (Standard)",
    connected: true,
    mapping: "standard",
    timestamp: 0,
    axes: options.axes ?? [0, 0, 0, 0],
    buttons,
    vibrationActuator: null,
  } as unknown as Gamepad;
}

describe("normalizeGamepad", () => {
  it("maps standard button indices to named buttons", () => {
    const state = normalizeGamepad(rawPad(2, { pressed: [0, 9, 12] }));
    expect(state.index).toBe(2);
    expect(state.connected).toBe(true);
    expect(state.buttons.a).toBe(true);
    expect(state.buttons.start).toBe(true);
    expect(state.buttons.up).toBe(true);
    expect(state.buttons.b).toBe(false);
  });

  it("exposes analog trigger values", () => {
    const state = normalizeGamepad(rawPad(0, { values: { 6: 0.4, 7: 0.9 } }));
    expect(state.buttons.lt).toBeCloseTo(0.4);
    expect(state.buttons.rt).toBeCloseTo(0.9);
  });

  it("applies a stick deadzone", () => {
    const state = normalizeGamepad(rawPad(0, { axes: [0.05, -0.5, 0.2, 0] }), 0.15);
    expect(state.axes.lx).toBe(0); // within deadzone -> zeroed
    expect(state.axes.ly).toBeCloseTo(-0.5);
    expect(state.axes.rx).toBeCloseTo(0.2);
  });
});
