import { describe, expect, it } from "vitest";
import type { LaunchContext } from "@pfp/sdk";
import { ForwardedInputReader, type ForwardedSource } from "../src/forwardedInput.js";

/** Tiny stand-in for a `@pfp/controls` ControlClient, keyed by `slot:action`. */
class FakeSource implements ForwardedSource {
  seq: number | null = null;
  axes = new Map<string, number>();
  held = new Map<string, boolean>();
  edges = new Map<string, boolean>();

  getLatestFrame() {
    return this.seq === null ? null : { seq: this.seq };
  }
  axis(slot: number, action: string) {
    return this.axes.get(`${slot}:${action}`) ?? 0;
  }
  isPressed(slot: number, action: string) {
    return this.held.get(`${slot}:${action}`) ?? false;
  }
  justPressed(slot: number, action: string) {
    return this.edges.get(`${slot}:${action}`) ?? false;
  }
}

/** Build a launch roster from a list of slots (other fields are unused here). */
function players(slots: number[]): LaunchContext["players"] {
  return slots.map((slot) => ({
    slot,
    profileId: null,
    displayName: `P${slot + 1}`,
    color: "#fff",
    gamepadIndex: slot,
  }));
}

describe("Space Invaders ForwardedInputReader", () => {
  it("returns null until a control frame has arrived", () => {
    const source = new FakeSource();
    expect(new ForwardedInputReader(source).sample(players([0]))).toBeNull();
  });

  it("maps input by slot, not array position, for a sparse roster", () => {
    const source = new FakeSource();
    source.seq = 1;
    // Roster is slots 1 and 3 (e.g. P2 and P4 joined).
    source.axes.set("1:move", -0.6);
    source.held.set("3:shoot", true);

    const frame = new ForwardedInputReader(source).sample(players([1, 3]));
    expect(frame?.inputs).toHaveLength(2);
    expect(frame?.inputs[0]?.axis).toBeCloseTo(-0.6); // slot 1
    expect(frame?.inputs[0]?.shoot).toBe(false);
    expect(frame?.inputs[1]?.axis).toBe(0); // slot 3
    expect(frame?.inputs[1]?.shoot).toBe(true);
  });

  it("treats shoot as held (not edge-gated)", () => {
    const source = new FakeSource();
    source.seq = 5;
    source.held.set("0:shoot", true);

    const reader = new ForwardedInputReader(source);
    // Held stays true across repeated reads of the same seq.
    expect(reader.sample(players([0]))?.inputs[0]?.shoot).toBe(true);
    expect(reader.sample(players([0]))?.inputs[0]?.shoot).toBe(true);
  });

  it("clamps out-of-range move axis to [-1, 1]", () => {
    const source = new FakeSource();
    source.seq = 1;
    source.axes.set("0:move", 1.4);
    expect(new ForwardedInputReader(source).sample(players([0]))?.inputs[0]?.axis).toBe(1);
  });

  it("fires anyStart if any player taps start, once per fresh seq", () => {
    const source = new FakeSource();
    source.seq = 2;
    source.edges.set("1:start", true); // only P2 pressed start

    const reader = new ForwardedInputReader(source);
    expect(reader.sample(players([0, 1]))?.anyStart).toBe(true);
    // Same seq read again: no repeat edge.
    expect(reader.sample(players([0, 1]))?.anyStart).toBe(false);
    // New seq with start still held re-fires.
    source.seq = 3;
    expect(reader.sample(players([0, 1]))?.anyStart).toBe(true);
  });
});
