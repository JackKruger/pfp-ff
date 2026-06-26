import { makeFrame, type PlayerFrame } from "../types.js";

/**
 * Direct-mode gamepad reader. The shell passes each player's gamepadIndex via
 * the LaunchContext; we keep one tracker per slot to compute edge-triggered
 * presses (jumpDown/jumpUp/etc.) without depending on the host loop's dt.
 */

const STICK_DEADZONE = 0.18;

interface SlotTracker {
  slot: number;
  gamepadIndex: number;
  // Held-state from the previous poll, used to derive edge triggers.
  prevA: boolean;
  prevB: boolean;
  prevX: boolean;
  prevY: boolean;
  prevLB: boolean;
  prevRB: boolean;
  prevStart: boolean;
  prevDPadUp: boolean;
}

export class InputReader {
  private trackers = new Map<number, SlotTracker>();
  private keyboard = new Set<string>();
  private keyboardEdges = new Set<string>();

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  /** Register a slot to read from a specific gamepad index. */
  bind(slot: number, gamepadIndex: number): void {
    this.trackers.set(slot, {
      slot,
      gamepadIndex,
      prevA: false,
      prevB: false,
      prevX: false,
      prevY: false,
      prevLB: false,
      prevRB: false,
      prevStart: false,
      prevDPadUp: false,
    });
  }

  /** Read one frame per registered slot. */
  poll(): PlayerFrame[] {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const out: PlayerFrame[] = [];

    for (const t of this.trackers.values()) {
      const f = makeFrame(t.slot);
      const pad = pads[t.gamepadIndex] ?? null;

      // Stick + dpad
      if (pad) {
        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        f.moveX = deadzone(ax);
        f.moveY = deadzone(ay);

        // Buttons: layout follows the standard mapping (A=0, B=1, X=2, Y=3,
        // LB=4, RB=5, Start=9, dpadUp=12, dpadDown=13, dpadLeft=14, dpadRight=15).
        const a = pressed(pad, 0);
        const b = pressed(pad, 1);
        const x = pressed(pad, 2);
        const y = pressed(pad, 3);
        const lb = pressed(pad, 4);
        const rb = pressed(pad, 5);
        const start = pressed(pad, 9);
        const dpUp = pressed(pad, 12);
        const dpDown = pressed(pad, 13);
        const dpLeft = pressed(pad, 14);
        const dpRight = pressed(pad, 15);

        if (dpLeft) f.moveX = -1;
        else if (dpRight) f.moveX = 1;
        if (dpUp) f.moveY = -1;
        else if (dpDown) f.moveY = 1;

        f.jumpHeld = a;
        f.jumpDown = a && !t.prevA;
        f.jumpUp = !a && t.prevA;
        f.confirmDown = a && !t.prevA;
        f.cancelDown = b && !t.prevB;
        f.nextDown = x && !t.prevX;
        f.prevDown = y && !t.prevY;
        f.rotCwDown = rb && !t.prevRB;
        f.rotCcwDown = lb && !t.prevLB;
        f.startDown = start && !t.prevStart;

        t.prevA = a;
        t.prevB = b;
        t.prevX = x;
        t.prevY = y;
        t.prevLB = lb;
        t.prevRB = rb;
        t.prevStart = start;
        t.prevDPadUp = dpUp;
      }

      // Keyboard fallback for slot 0 only — used for standalone dev.
      if (t.slot === 0 && !pad) {
        this.applyKeyboard(f);
      }

      out.push(f);
    }

    this.keyboardEdges.clear();
    return out;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.keyboard.has(e.code)) this.keyboardEdges.add(e.code);
    this.keyboard.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keyboard.delete(e.code);
  };

  private applyKeyboard(f: PlayerFrame): void {
    if (this.keyboard.has("ArrowLeft") || this.keyboard.has("KeyA")) f.moveX = -1;
    else if (this.keyboard.has("ArrowRight") || this.keyboard.has("KeyD")) f.moveX = 1;
    if (this.keyboard.has("ArrowUp") || this.keyboard.has("KeyW")) f.moveY = -1;
    else if (this.keyboard.has("ArrowDown") || this.keyboard.has("KeyS")) f.moveY = 1;
    const jumpHeld =
      this.keyboard.has("Space") || this.keyboard.has("KeyJ") || this.keyboard.has("KeyZ");
    f.jumpHeld = jumpHeld;
    f.jumpDown = this.keyboardEdges.has("Space") || this.keyboardEdges.has("KeyJ");
    f.confirmDown = f.jumpDown;
    f.cancelDown = this.keyboardEdges.has("KeyK") || this.keyboardEdges.has("Escape");
    f.nextDown = this.keyboardEdges.has("KeyE");
    f.prevDown = this.keyboardEdges.has("KeyQ");
    f.rotCwDown = this.keyboardEdges.has("KeyR");
    f.rotCcwDown = this.keyboardEdges.has("KeyT");
    f.startDown = this.keyboardEdges.has("Enter");
  }
}

function deadzone(v: number): number {
  return Math.abs(v) < STICK_DEADZONE ? 0 : v;
}

function pressed(pad: Gamepad, idx: number): boolean {
  const b = pad.buttons[idx];
  if (!b) return false;
  return typeof b === "object" ? b.pressed : (b as unknown as number) > 0.5;
}
