import { describe, expect, it } from "vitest";
import type { PlayerSlot } from "@pfp/sdk";
import { KeyboardControlSource } from "../src/keyboard.js";
import { createControlFrame, type ControlPoller } from "../src/frame.js";

/** A poller with no connected gamepads — forces the keyboard fallback. */
const noGamepads: ControlPoller = {
  getState: () => null,
  pressed: () => false,
  justPressed: () => false,
  justReleased: () => false,
  trigger: () => 0,
};

function player(slot: number, gamepadIndex: number): PlayerSlot {
  return { slot, profileId: null, displayName: `P${slot + 1}`, color: "#fff", gamepadIndex };
}

describe("KeyboardControlSource", () => {
  it("drives left-stick axes from movement keys (default P1 = WASD)", () => {
    const kb = new KeyboardControlSource();
    kb.set("KeyD", true); // right
    kb.set("KeyW", true); // up
    kb.tick();

    const state = kb.getState(0);
    expect(state?.axes.lx).toBe(1);
    expect(state?.axes.ly).toBe(-1); // up is negative
    expect(state?.buttons.right).toBe(true);
  });

  it("detects button edges across ticks", () => {
    const kb = new KeyboardControlSource();
    kb.set("Space", true); // P1 'a'
    kb.tick();
    expect(kb.justPressed(0, "a")).toBe(true);

    kb.tick(); // still held, no new edge
    expect(kb.justPressed(0, "a")).toBe(false);
    expect(kb.pressed(0, "a")).toBe(true);

    kb.set("Space", false);
    kb.tick();
    expect(kb.justReleased(0, "a")).toBe(true);
  });

  it("maps separate slots independently", () => {
    const kb = new KeyboardControlSource();
    kb.set("ArrowLeft", true); // P2 left
    kb.tick();
    expect(kb.getState(1)?.axes.lx).toBe(-1);
    expect(kb.getState(0)?.axes.lx).toBe(0);
  });

  it("feeds the control frame for a disconnected gamepad slot", () => {
    const kb = new KeyboardControlSource();
    kb.set("KeyA", true); // P1 left
    kb.tick();

    const frame = createControlFrame({
      seq: 1,
      now: 0,
      dtMs: 16,
      paused: false,
      players: [player(0, -1)], // no gamepad
      poller: noGamepads,
      keyboard: kb,
      schema: { actions: { move: [{ source: "leftStickX" }] } },
    });

    const p0 = frame.players[0];
    expect(p0?.connected).toBe(true);
    expect(p0?.source).toBe("keyboard");
    expect(p0?.actions.move?.value).toBe(-1);
  });

  it("prefers a connected gamepad over the keyboard for the same slot", () => {
    const kb = new KeyboardControlSource();
    kb.set("KeyD", true); // keyboard says right
    kb.tick();

    const gamepad: ControlPoller = {
      getState: (i) =>
        i === 3
          ? { index: 3, connected: true, buttons: neutral(), axes: { lx: 0, ly: 0, rx: 0, ry: 0 } }
          : null,
      pressed: () => false,
      justPressed: () => false,
      justReleased: () => false,
      trigger: () => 0,
    };

    const frame = createControlFrame({
      seq: 1,
      now: 0,
      dtMs: 16,
      paused: false,
      players: [player(0, 3)], // gamepad 3 connected
      poller: gamepad,
      keyboard: kb,
      schema: { actions: { move: [{ source: "leftStickX" }] } },
    });

    expect(frame.players[0]?.source).toBe("gamepad");
    expect(frame.players[0]?.actions.move?.value).toBe(0); // gamepad neutral, not keyboard's right
  });
});

function neutral() {
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
