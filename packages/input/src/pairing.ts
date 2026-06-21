/**
 * The "press A to join" pairing lobby — a pure state machine driven by input
 * each tick. Owns controller<->slot binding (P1..P4); profile selection is
 * layered on top by the shell. See docs/ARCHITECTURE.md §6.
 *
 * Slot numbers are stable: if P2 leaves, P1/P3 keep their numbers and the next
 * joiner takes the lowest free slot (filling the gap).
 */
import type { PairingInput } from "./poller.js";
import type { DigitalButton } from "./types.js";

export interface PairingSlot {
  /** 0..maxPlayers-1 — P1..PN. */
  slot: number;
  gamepadIndex: number;
  profileId: string | null;
}

export type PairingEvent =
  | { type: "join"; slot: number; gamepadIndex: number }
  | { type: "leave"; slot: number; gamepadIndex: number }
  | { type: "disconnect"; slot: number; gamepadIndex: number };

export interface PairingOptions {
  maxPlayers?: number;
  joinButton?: DigitalButton;
  leaveButton?: DigitalButton;
}

export class PairingLobby {
  private slots: PairingSlot[] = [];
  private readonly maxPlayers: number;
  private readonly joinButton: DigitalButton;
  private readonly leaveButton: DigitalButton;
  private readonly changeHandlers = new Set<(slots: PairingSlot[]) => void>();

  constructor(options: PairingOptions = {}) {
    this.maxPlayers = options.maxPlayers ?? 4;
    this.joinButton = options.joinButton ?? "a";
    this.leaveButton = options.leaveButton ?? "b";
  }

  /** Advance the lobby for one input tick. Returns what changed this tick. */
  update(input: PairingInput): PairingEvent[] {
    const events: PairingEvent[] = [];
    const connected = new Set(input.connectedIndices());

    // 1. Disconnected controllers drop their slot.
    for (const slot of [...this.slots]) {
      if (!connected.has(slot.gamepadIndex)) {
        this.removeSlot(slot);
        events.push({ type: "disconnect", slot: slot.slot, gamepadIndex: slot.gamepadIndex });
      }
    }

    // 2. Joined controllers pressing the leave button drop out.
    for (const slot of [...this.slots]) {
      if (input.justPressed(slot.gamepadIndex, this.leaveButton)) {
        this.removeSlot(slot);
        events.push({ type: "leave", slot: slot.slot, gamepadIndex: slot.gamepadIndex });
      }
    }

    // 3. Unjoined controllers pressing the join button claim the lowest free slot.
    const occupied = new Set(this.slots.map((s) => s.gamepadIndex));
    for (const index of input.connectedIndices()) {
      if (occupied.has(index)) continue;
      if (!input.justPressed(index, this.joinButton)) continue;
      const slot = this.nextFreeSlot();
      if (slot === null) continue; // lobby full
      this.slots.push({ slot, gamepadIndex: index, profileId: null });
      occupied.add(index);
      events.push({ type: "join", slot, gamepadIndex: index });
    }

    if (events.length > 0) {
      this.slots.sort((a, b) => a.slot - b.slot);
      this.emitChange();
    }
    return events;
  }

  assignProfile(slot: number, profileId: string | null): void {
    const target = this.slots.find((s) => s.slot === slot);
    if (!target) return;
    target.profileId = profileId;
    this.emitChange();
  }

  getSlots(): PairingSlot[] {
    return this.slots.map((s) => ({ ...s }));
  }

  /** Every joined slot has chosen a profile (or guest), and at least one joined. */
  get isReady(): boolean {
    return this.slots.length > 0;
  }

  reset(): void {
    this.slots = [];
    this.emitChange();
  }

  onChange(handler: (slots: PairingSlot[]) => void): () => void {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  private removeSlot(slot: PairingSlot): void {
    this.slots = this.slots.filter((s) => s !== slot);
  }

  private nextFreeSlot(): number | null {
    const used = new Set(this.slots.map((s) => s.slot));
    for (let i = 0; i < this.maxPlayers; i++) {
      if (!used.has(i)) return i;
    }
    return null;
  }

  private emitChange(): void {
    const snapshot = this.getSlots();
    for (const handler of this.changeHandlers) handler(snapshot);
  }
}
