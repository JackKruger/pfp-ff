import { describe, expect, it, vi } from "vitest";
import { PairingLobby, type DigitalButton, type PairingInput } from "../src/index.js";

/**
 * Scriptable PairingInput: set which controllers are connected and which buttons
 * are "just pressed" this tick, then call lobby.update(fake).
 */
class FakeInput implements PairingInput {
  private connected: number[] = [];
  private justPressedMap = new Map<string, boolean>();

  setConnected(indices: number[]): this {
    this.connected = indices;
    return this;
  }

  press(index: number, button: DigitalButton): this {
    this.justPressedMap.set(`${index}:${button}`, true);
    return this;
  }

  /** Clear per-tick edges (call between ticks). */
  clearEdges(): this {
    this.justPressedMap.clear();
    return this;
  }

  connectedIndices(): number[] {
    return this.connected;
  }

  justPressed(index: number, button: DigitalButton): boolean {
    return this.justPressedMap.get(`${index}:${button}`) ?? false;
  }
}

describe("PairingLobby", () => {
  it("joins controllers on A into stable slots", () => {
    const lobby = new PairingLobby();
    const input = new FakeInput().setConnected([0, 1, 2]);

    input.press(0, "a").press(2, "a");
    const events = lobby.update(input);

    expect(events).toEqual([
      { type: "join", slot: 0, gamepadIndex: 0 },
      { type: "join", slot: 1, gamepadIndex: 2 },
    ]);
    expect(lobby.getSlots()).toEqual([
      { slot: 0, gamepadIndex: 0, profileId: null },
      { slot: 1, gamepadIndex: 2, profileId: null },
    ]);
  });

  it("does not double-join a controller already in a slot", () => {
    const lobby = new PairingLobby();
    const input = new FakeInput().setConnected([0]);

    lobby.update(input.press(0, "a"));
    const events = lobby.update(input.clearEdges().press(0, "a"));
    expect(events).toEqual([]);
    expect(lobby.getSlots()).toHaveLength(1);
  });

  it("leaves on B and the freed slot is reused by the next joiner", () => {
    const lobby = new PairingLobby();
    const input = new FakeInput().setConnected([0, 1]);

    lobby.update(input.press(0, "a")); // P1 = pad 0
    lobby.update(input.clearEdges().press(1, "a")); // P2 = pad 1
    expect(lobby.getSlots().map((s) => s.slot)).toEqual([0, 1]);

    const leave = lobby.update(input.clearEdges().press(0, "b"));
    expect(leave).toEqual([{ type: "leave", slot: 0, gamepadIndex: 0 }]);

    // pad 0 rejoins -> fills the lowest free slot (0 again)
    const rejoin = lobby.update(input.clearEdges().press(0, "a"));
    expect(rejoin).toEqual([{ type: "join", slot: 0, gamepadIndex: 0 }]);
  });

  it("drops a slot when its controller disconnects", () => {
    const lobby = new PairingLobby();
    const input = new FakeInput().setConnected([0, 1]);
    lobby.update(input.press(0, "a"));
    lobby.update(input.clearEdges().press(1, "a"));

    const events = lobby.update(input.clearEdges().setConnected([1]));
    expect(events).toEqual([{ type: "disconnect", slot: 0, gamepadIndex: 0 }]);
    expect(lobby.getSlots().map((s) => s.gamepadIndex)).toEqual([1]);
  });

  it("caps joins at maxPlayers", () => {
    const lobby = new PairingLobby({ maxPlayers: 2 });
    const input = new FakeInput().setConnected([0, 1, 2]);
    input.press(0, "a").press(1, "a").press(2, "a");
    const events = lobby.update(input);
    expect(events.filter((e) => e.type === "join")).toHaveLength(2);
    expect(lobby.getSlots()).toHaveLength(2);
  });

  it("assigns profiles and notifies change subscribers", () => {
    const lobby = new PairingLobby();
    const onChange = vi.fn();
    lobby.onChange(onChange);

    const input = new FakeInput().setConnected([0]);
    lobby.update(input.press(0, "a"));
    expect(onChange).toHaveBeenCalledTimes(1);

    lobby.assignProfile(0, "profile-123");
    expect(lobby.getSlots()[0].profileId).toBe("profile-123");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(lobby.isReady).toBe(true);
  });
});
