import type { PlayerInput } from "./game.js";

const DEADZONE = 0.18;

export interface InputFrame {
  p1: PlayerInput;
  p2: PlayerInput;
}

const GAME_KEYS = new Set(["w", "W", "s", "S", "ArrowUp", "ArrowDown", "Enter", " ", "Escape"]);

/**
 * Reads paddle input for two players from the Gamepad API, with a keyboard
 * fallback for dev (P1 = W/S, P2 = arrows; Enter/Space = start, Escape = back).
 * `start`/`back` are reported as edges (true only on the frame of the press).
 */
export class InputReader {
  private keys = new Set<string>();
  private prevStart: [boolean, boolean] = [false, false];
  private prevBack: [boolean, boolean] = [false, false];

  private onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.key)) e.preventDefault();
    this.keys.add(e.key);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key);
  };

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  sample(p1PadIndex: number, p2PadIndex: number): InputFrame {
    return {
      p1: this.readPlayer(0, p1PadIndex),
      p2: this.readPlayer(1, p2PadIndex),
    };
  }

  private readPlayer(idx: 0 | 1, padIndex: number): PlayerInput {
    const pad = navigator.getGamepads?.()[padIndex] ?? null;
    let axis = 0;
    let startHeld = false;
    let backHeld = false;

    if (pad) {
      const stick = pad.axes[1] ?? 0;
      if (Math.abs(stick) >= DEADZONE) axis = stick;
      if (pad.buttons[12]?.pressed) axis = -1; // d-pad up
      if (pad.buttons[13]?.pressed) axis = 1; // d-pad down
      startHeld = pad.buttons[9]?.pressed ?? false; // Start / Menu
      backHeld = pad.buttons[1]?.pressed ?? false; // B
    }

    const up = idx === 0 ? this.keys.has("w") || this.keys.has("W") : this.keys.has("ArrowUp");
    const down = idx === 0 ? this.keys.has("s") || this.keys.has("S") : this.keys.has("ArrowDown");
    if (up) axis = -1;
    if (down) axis = 1;
    if (this.keys.has("Enter") || this.keys.has(" ")) startHeld = true;
    if (this.keys.has("Escape")) backHeld = true;

    const start = startHeld && !this.prevStart[idx];
    const back = backHeld && !this.prevBack[idx];
    this.prevStart[idx] = startHeld;
    this.prevBack[idx] = backHeld;

    return { axis: axis < -1 ? -1 : axis > 1 ? 1 : axis, start, back };
  }
}
