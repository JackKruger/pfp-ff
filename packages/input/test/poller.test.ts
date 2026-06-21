import { describe, expect, it, vi } from "vitest";
import {
  InputPoller,
  ManualGamepadSource,
  neutralGamepadState,
  type GamepadState,
} from "../src/index.js";

function pad(index: number, press: Partial<GamepadState["buttons"]> = {}): GamepadState {
  const state = neutralGamepadState(index);
  Object.assign(state.buttons, press);
  return state;
}

describe("InputPoller edge detection", () => {
  it("reports justPressed/justReleased across ticks", () => {
    const source = new ManualGamepadSource();
    const poller = new InputPoller(source);

    source.setStates([pad(0)]);
    poller.tick();
    expect(poller.justPressed(0, "a")).toBe(false);

    source.setStates([pad(0, { a: true })]);
    poller.tick();
    expect(poller.justPressed(0, "a")).toBe(true);
    expect(poller.pressed(0, "a")).toBe(true);

    // held: pressed stays true, justPressed goes false
    poller.tick();
    expect(poller.justPressed(0, "a")).toBe(false);
    expect(poller.pressed(0, "a")).toBe(true);

    source.setStates([pad(0)]);
    poller.tick();
    expect(poller.justReleased(0, "a")).toBe(true);
    expect(poller.pressed(0, "a")).toBe(false);
  });

  it("fires connect and disconnect (hot-plug) events", () => {
    const source = new ManualGamepadSource();
    const poller = new InputPoller(source);
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    poller.onConnect(onConnect);
    poller.onDisconnect(onDisconnect);

    source.setStates([pad(0), null]);
    poller.tick();
    expect(onConnect).toHaveBeenCalledWith(0);
    expect(poller.connectedIndices()).toEqual([0]);

    // controller 1 plugged in
    source.setStates([pad(0), pad(1)]);
    poller.tick();
    expect(onConnect).toHaveBeenCalledWith(1);
    expect(poller.connectedIndices()).toEqual([0, 1]);

    // controller 0 yanked out
    source.setStates([null, pad(1)]);
    poller.tick();
    expect(onDisconnect).toHaveBeenCalledWith(0);
    expect(poller.connectedIndices()).toEqual([1]);
  });

  it("detects edges even when the source is mutated in place via set()", () => {
    const source = new ManualGamepadSource();
    const poller = new InputPoller(source);

    source.set(0, pad(0));
    poller.tick();
    source.set(0, pad(0, { a: true })); // in-place mutation, no setStates
    poller.tick();
    expect(poller.justPressed(0, "a")).toBe(true);
  });

  it("does not report a phantom press for a button held before the first tick", () => {
    const source = new ManualGamepadSource();
    const poller = new InputPoller(source);
    source.setStates([pad(0, { a: true })]); // A already held as polling begins
    poller.tick();
    expect(poller.justPressed(0, "a")).toBe(false);
    expect(poller.pressed(0, "a")).toBe(true);
  });

  it("reads analog triggers", () => {
    const source = new ManualGamepadSource();
    const poller = new InputPoller(source);
    source.setStates([pad(0, { rt: 0.75 })]);
    poller.tick();
    expect(poller.trigger(0, "rt")).toBeCloseTo(0.75);
  });
});
