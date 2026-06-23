import { describe, expect, it } from "vitest";
import { ForwardedInputReader, type ForwardedSource } from "../src/forwardedInput.js";

/** Tiny stand-in for a `@pfp/controls` ControlClient, keyed by `slot:action`. */
class FakeSource implements ForwardedSource {
  seq: number | null = null;
  axes = new Map<string, number>();
  edges = new Map<string, boolean>();

  getLatestFrame() {
    return this.seq === null ? null : { seq: this.seq };
  }
  axis(slot: number, action: string) {
    return this.axes.get(`${slot}:${action}`) ?? 0;
  }
  justPressed(slot: number, action: string) {
    return this.edges.get(`${slot}:${action}`) ?? false;
  }
}

describe("ForwardedInputReader", () => {
  it("returns null until a control frame has arrived", () => {
    const source = new FakeSource();
    expect(new ForwardedInputReader(source).sample()).toBeNull();
  });

  it("maps per-slot paddle axes to P1/P2 input", () => {
    const source = new FakeSource();
    source.seq = 1;
    source.axes.set("0:paddle", -0.7);
    source.axes.set("1:paddle", 0.4);

    const frame = new ForwardedInputReader(source).sample();
    expect(frame?.p1.axis).toBeCloseTo(-0.7);
    expect(frame?.p2.axis).toBeCloseTo(0.4);
  });

  it("clamps out-of-range axis values to [-1, 1]", () => {
    const source = new FakeSource();
    source.seq = 1;
    source.axes.set("0:paddle", -1.5);
    source.axes.set("1:paddle", 2);

    const frame = new ForwardedInputReader(source).sample();
    expect(frame?.p1.axis).toBe(-1);
    expect(frame?.p2.axis).toBe(1);
  });

  it("surfaces start/back edges only on a fresh frame, not on a repeated seq", () => {
    const source = new FakeSource();
    source.seq = 7;
    source.edges.set("0:start", true);
    source.edges.set("1:back", true);

    const reader = new ForwardedInputReader(source);

    // First read of seq 7: edges fire.
    const first = reader.sample();
    expect(first?.p1.start).toBe(true);
    expect(first?.p2.back).toBe(true);

    // Same seq read again (e.g. next animation frame before a new frame): no edge.
    const second = reader.sample();
    expect(second?.p1.start).toBe(false);
    expect(second?.p2.back).toBe(false);

    // A new seq with the edge still held re-fires it.
    source.seq = 8;
    const third = reader.sample();
    expect(third?.p1.start).toBe(true);
  });
});
