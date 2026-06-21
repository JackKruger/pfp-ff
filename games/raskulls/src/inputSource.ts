import { BrowserGamepadSource } from "@pfp/input";
import type { GamepadState } from "@pfp/input";
import type { PlayerSlot } from "@pfp/sdk";
import {
  KEYBOARD_MAPPINGS,
  normalizeActions,
  type PlayerActions,
} from "./systems/input.js";

export class BrowserActionSource {
  private readonly source = new BrowserGamepadSource();
  private readonly keys = new Set<string>();
  private previousKeys = new Set<string>();
  private pads: (GamepadState | null)[] = [];
  private previousPads: (GamepadState | null)[] = [];
  private disposed = false;

  constructor(private readonly target: Window = window) {
    target.addEventListener("keydown", this.handleKeyDown);
    target.addEventListener("keyup", this.handleKeyUp);
  }

  tick(): void {
    this.previousPads = this.pads;
    this.pads = this.source.read();
  }

  commit(): void {
    this.previousKeys = new Set(this.keys);
  }

  actionsFor(player: Pick<PlayerSlot, "slot" | "gamepadIndex">): PlayerActions {
    const mapping = KEYBOARD_MAPPINGS[player.slot] ?? KEYBOARD_MAPPINGS[0]!;
    const gamepad = player.gamepadIndex >= 0 ? this.pads[player.gamepadIndex] ?? null : null;
    const previousGamepad =
      player.gamepadIndex >= 0 ? this.previousPads[player.gamepadIndex] ?? null : null;

    return normalizeActions({
      gamepad,
      previousGamepad,
      keys: this.keys,
      previousKeys: this.previousKeys,
      mapping,
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    this.keys.clear();
    this.previousKeys.clear();
    this.disposed = true;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
    if (isMappedKey(event.code)) event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
    if (isMappedKey(event.code)) event.preventDefault();
  };
}

function isMappedKey(code: string): boolean {
  return KEYBOARD_MAPPINGS.some((mapping) => Object.values(mapping).includes(code));
}
