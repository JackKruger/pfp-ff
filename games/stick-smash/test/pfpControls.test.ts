import { createControlFrame, type ControlPoller } from "@pfp/controls";
import { describe, expect, it } from "vitest";
import manifest from "../game.manifest.js";
import { PfpControls } from "../src/input/PfpControls.js";

const DIGITAL_BUTTONS = [
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

type DigitalButton = (typeof DIGITAL_BUTTONS)[number];

interface PadState {
  axes?: Partial<{ lx: number; ly: number; rx: number; ry: number }>;
  buttons?: Partial<Record<DigitalButton, boolean>> & Partial<Record<"lt" | "rt", number>>;
}

class FakePoller implements ControlPoller {
  constructor(private readonly state: PadState) {}

  getState(index: number) {
    const buttons = Object.fromEntries(
      DIGITAL_BUTTONS.map((button) => [button, this.pressed(index, button)]),
    ) as unknown as Record<DigitalButton, boolean> & { lt: number; rt: number };
    buttons.lt = this.trigger(index, "lt");
    buttons.rt = this.trigger(index, "rt");

    return {
      index,
      connected: true,
      axes: {
        lx: this.state.axes?.lx ?? 0,
        ly: this.state.axes?.ly ?? 0,
        rx: this.state.axes?.rx ?? 0,
        ry: this.state.axes?.ry ?? 0,
      },
      buttons,
    };
  }

  pressed(_index: number, button: DigitalButton): boolean {
    return this.state.buttons?.[button] ?? false;
  }

  justPressed(index: number, button: DigitalButton): boolean {
    return this.pressed(index, button);
  }

  justReleased(): boolean {
    return false;
  }

  trigger(_index: number, which: "lt" | "rt"): number {
    return this.state.buttons?.[which] ?? 0;
  }
}

describe("PfpControls", () => {
  it("returns neutral input when no frame exists", () => {
    const controls = new PfpControls({ getLatestFrame: () => null });

    expect(controls.getSnapshotForSlot(0)).toEqual({
      moveX: 0,
      moveY: 0,
      jump: false,
      attack: false,
      grab: false,
      special: false,
      throw: false,
      aimX: 0,
      aimY: 0,
      aimActive: false,
    });
  });

  it("maps left stick and d-pad movement to Stick Smash axes", () => {
    expect(snapshot({ axes: { lx: 1 } }).moveX).toBe(1);
    expect(snapshot({ axes: { ly: -1 } }).moveY).toBe(1);
    expect(snapshot({ buttons: { up: true } }).moveY).toBe(1);
  });

  it("maps right stick aim and ignores low-magnitude aim", () => {
    const aimed = snapshot({ axes: { rx: 0.8, ry: -0.6 } });
    expect(aimed.aimX).toBeCloseTo(0.8);
    expect(aimed.aimY).toBeCloseTo(0.6);
    expect(aimed.aimActive).toBe(true);

    const low = snapshot({ axes: { rx: 0.2, ry: 0 } });
    expect(low.aimActive).toBe(false);
  });

  it("maps shell button actions to Stick Smash buttons", () => {
    expect(snapshot({ buttons: { a: true } }).jump).toBe(true);
    expect(snapshot({ buttons: { rt: 1 } }).attack).toBe(true);
    expect(snapshot({ buttons: { rb: true } }).attack).toBe(true);
    expect(snapshot({ buttons: { x: true } }).grab).toBe(true);
    expect(snapshot({ buttons: { lb: true } }).grab).toBe(true);
    expect(snapshot({ buttons: { lt: 1 } }).grab).toBe(true);
    expect(snapshot({ buttons: { b: true } }).throw).toBe(true);
    expect(snapshot({ buttons: { y: true } }).special).toBe(true);
  });
});

function snapshot(state: PadState) {
  const frame = createControlFrame({
    seq: 1,
    now: 0,
    dtMs: 16,
    paused: false,
    players: [
      {
        slot: 0,
        profileId: "p1",
        displayName: "P1",
        color: "#fff",
        gamepadIndex: 0,
      },
    ],
    poller: new FakePoller(state),
    schema: { actions: manifest.input.actions ?? {} },
  });
  return new PfpControls({ getLatestFrame: () => frame }).getSnapshotForSlot(0);
}
