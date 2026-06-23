import { describe, expect, it, vi } from "vitest";
import { neutralGamepadState, type GamepadState } from "@pfp/input";
import type { ControlButton, ControlFrame, PlayerSlot } from "@pfp/sdk";
import {
  createControlClient,
  createControlForwarder,
  createControlFrame,
  schemaFromManifest,
  type ControlPoller,
} from "../src/index.js";

describe("control frames", () => {
  it("maps normalized gamepad state into buttons, axes, and actions", () => {
    const poller = fakePoller([
      {
        ...neutralGamepadState(0),
        buttons: { ...neutralGamepadState(0).buttons, a: true, right: true, rt: 0.75 },
        axes: { lx: 0.6, ly: -0.25, rx: 0.1, ry: -0.8 },
      },
    ]);
    poller.justPressedButtons.add("0:a");

    const frame = createControlFrame({
      seq: 7,
      now: 1000,
      dtMs: 16,
      paused: false,
      players: [player()],
      poller,
      schema: schemaFromManifest({
        mode: "forwarded",
        actions: {
          jump: [{ source: "a" }],
          move: [{ source: "leftStickX", deadzone: 0.2 }],
          dpad: [{ source: "dpadX" }],
          fire: [{ source: "rt" }],
        },
      }),
    });

    expect(frame.seq).toBe(7);
    expect(frame.players[0]).toMatchObject({
      slot: 0,
      profileId: "p1",
      connected: true,
      source: "gamepad",
      axes: { moveX: 0.6, moveY: -0.25, aimX: 0.1, aimY: -0.8, throttle: 0.75 },
    });
    expect(frame.players[0]?.buttons.a).toEqual({
      pressed: true,
      justPressed: true,
      justReleased: false,
      value: 1,
    });
    expect(frame.players[0]?.buttons.rt).toMatchObject({ pressed: true, value: 0.75 });
    expect(frame.players[0]?.actions.jump).toMatchObject({ pressed: true, justPressed: true });
    expect(frame.players[0]?.actions.move).toMatchObject({ pressed: true, value: 0.6 });
    expect(frame.players[0]?.actions.dpad).toMatchObject({ pressed: true, value: 1 });
    expect(frame.players[0]?.actions.fire).toMatchObject({ pressed: true, value: 0.75 });
  });

  it("marks disconnected and keyboard slots as source none in the minimal prototype", () => {
    const frame = createControlFrame({
      seq: 1,
      now: 0,
      dtMs: 0,
      paused: false,
      players: [player({ gamepadIndex: -1 })],
      poller: fakePoller([]),
      schema: schemaFromManifest({
        mode: "forwarded",
        actions: { jump: [{ source: "a" }] },
      }),
    });

    expect(frame.players[0]).toMatchObject({
      connected: false,
      source: "none",
    });
    expect(frame.players[0]?.actions.jump).toEqual(releasedAction());
  });
});

describe("control forwarder", () => {
  it("sends sequenced frames with capped dt and pause state", () => {
    const host = { sendInputFrame: vi.fn() };
    const clockValues = [0, 20, 220, 240];
    const forwarder = createControlForwarder({
      host,
      poller: fakePoller([neutralGamepadState(0)]),
      players: [player()],
      schema: schemaFromManifest({ mode: "forwarded", actions: {} }),
      clock: () => clockValues.shift() ?? 240,
      maxDtMs: 50,
    });

    forwarder.sendFrame();
    forwarder.setPaused(true);
    forwarder.sendFrame();

    expect(host.sendInputFrame).toHaveBeenCalledTimes(2);
    expect(host.sendInputFrame.mock.calls[0]?.[0]).toMatchObject({
      seq: 1,
      dtMs: 20,
      paused: false,
    });
    expect(host.sendInputFrame.mock.calls[1]?.[0]).toMatchObject({
      seq: 2,
      dtMs: 20,
      paused: true,
    });
  });

  it("does not send frames after dispose", () => {
    const host = { sendInputFrame: vi.fn() };
    const forwarder = createControlForwarder({
      host,
      poller: fakePoller([neutralGamepadState(0)]),
      players: [player()],
    });

    forwarder.dispose();
    forwarder.sendFrame();

    expect(host.sendInputFrame).not.toHaveBeenCalled();
  });
});

describe("control client", () => {
  it("caches latest frames and exposes action helpers", () => {
    let inputHandler: ((frame: ControlFrame) => void) | undefined;
    const unsubscribe = vi.fn();
    const client = createControlClient({
      onInputFrame(handler) {
        inputHandler = handler;
        return unsubscribe;
      },
    });
    const frame = {
      seq: 1,
      now: 0,
      dtMs: 16,
      paused: false,
      players: [
        {
          slot: 0,
          profileId: null,
          connected: true,
          source: "gamepad",
          axes: { moveX: 0, moveY: 0, aimX: 0, aimY: 0 },
          buttons: releasedButtons(),
          actions: {
            move: { ...releasedAction(), pressed: true, value: -0.75 },
            jump: { ...releasedAction(), pressed: true, justPressed: true, value: 1 },
          },
        },
      ],
    } satisfies ControlFrame;

    if (!inputHandler) throw new Error("expected control client to subscribe to input frames");
    inputHandler(frame);

    expect(client.getLatestFrame()).toBe(frame);
    expect(client.axis(0, "move")).toBe(-0.75);
    expect(client.isPressed(0, "jump")).toBe(true);
    expect(client.justPressed(0, "jump")).toBe(true);

    client.dispose();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(client.getLatestFrame()).toBeNull();
  });
});

function player(overrides: Partial<PlayerSlot> = {}): PlayerSlot {
  return {
    slot: 0,
    profileId: "p1",
    displayName: "Ann",
    color: "#f00",
    gamepadIndex: 0,
    ...overrides,
  };
}

function fakePoller(states: GamepadState[]): ControlPoller & { justPressedButtons: Set<string> } {
  const justPressedButtons = new Set<string>();
  const stateByIndex = new Map(states.map((state) => [state.index, state]));
  return {
    justPressedButtons,
    getState(index) {
      return stateByIndex.get(index) ?? null;
    },
    pressed(index, button) {
      return stateByIndex.get(index)?.buttons[button] ?? false;
    },
    justPressed(index, button) {
      return justPressedButtons.has(`${index}:${button}`);
    },
    justReleased() {
      return false;
    },
    trigger(index, which) {
      return stateByIndex.get(index)?.buttons[which] ?? 0;
    },
  };
}

function releasedButtons(): Record<ControlButton, ReturnType<typeof releasedAction>> {
  return {
    a: releasedAction(),
    b: releasedAction(),
    x: releasedAction(),
    y: releasedAction(),
    lb: releasedAction(),
    rb: releasedAction(),
    lt: releasedAction(),
    rt: releasedAction(),
    start: releasedAction(),
    back: releasedAction(),
    up: releasedAction(),
    down: releasedAction(),
    left: releasedAction(),
    right: releasedAction(),
  };
}

function releasedAction() {
  return {
    pressed: false,
    justPressed: false,
    justReleased: false,
    value: 0,
  };
}
