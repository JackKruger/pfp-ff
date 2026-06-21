import type { LaunchContext } from "@pfp/sdk";
import { type InputFrame, type PlayerInput } from "./game.js";

const DEADZONE = 0.18;

/**
 * Keyboard layout per player index:
 * 0: A/D move, Space shoot, Enter start, Escape back
 * 1: arrows move, Numpad0 shoot
 * 2: Numpad4/6 move, NumpadEnter shoot
 * 3: F/H move, Tab shoot
 */
const KEY_LAYOUTS: { left: string[]; right: string[]; shoot: string[] }[] = [
  { left: ["a", "A"], right: ["d", "D"], shoot: [" "] },
  { left: ["ArrowLeft"], right: ["ArrowRight"], shoot: ["Numpad0"] },
  { left: ["Numpad4"], right: ["Numpad6"], shoot: ["NumpadEnter"] },
  { left: ["f", "F"], right: ["h", "H"], shoot: ["Tab", "NumpadAdd"] },
];

const START_KEYS = new Set(["Enter", "NumpadEnter"]);
const BACK_KEYS = new Set(["Escape"]);
const ALL_GAME_KEYS = new Set<string>();
for (const l of KEY_LAYOUTS) {
  for (const k of [...l.left, ...l.right, ...l.shoot]) ALL_GAME_KEYS.add(k);
}
for (const k of [...START_KEYS, ...BACK_KEYS]) ALL_GAME_KEYS.add(k);

export class InputReader {
  private keys = new Set<string>();
  private prevStartGlobal = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (ALL_GAME_KEYS.has(e.key)) e.preventDefault();
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

  sample(players: LaunchContext["players"]): InputFrame {
    const inputs: PlayerInput[] = [];
    let anyStart = false;

    for (let i = 0; i < players.length; i++) {
      const player = players[i]!;
      inputs.push(this.readPlayer(player.gamepadIndex, i));
    }

    // Global start/back (any player's Start button or keyboard)
    const kbStart = [...START_KEYS].some((k) => this.keys.has(k));
    let gamepadStart = false;
    for (const p of players) {
      const pad = navigator.getGamepads?.()[p.gamepadIndex] ?? null;
      if (pad) {
        if (pad.buttons[9]?.pressed) gamepadStart = true;
      }
    }

    const startNow = kbStart || gamepadStart;
    anyStart = startNow && !this.prevStartGlobal;

    this.prevStartGlobal = startNow;

    return { inputs, anyStart };
  }

  private readPlayer(padIndex: number, playerIdx: number): PlayerInput {
    const pad = navigator.getGamepads?.()[padIndex] ?? null;
    let axis = 0;
    let shootHeld = false;

    if (pad) {
      const stick = pad.axes[0] ?? 0;
      if (Math.abs(stick) >= DEADZONE) axis = stick;
      if (pad.buttons[14]?.pressed) axis = -1; // d-pad left
      if (pad.buttons[15]?.pressed) axis = 1; // d-pad right
      shootHeld = pad.buttons[0]?.pressed ?? false; // A
    }

    // Keyboard fallback
    const layout = KEY_LAYOUTS[playerIdx];
    if (layout) {
      if (layout.left.some((k) => this.keys.has(k))) axis = -1;
      if (layout.right.some((k) => this.keys.has(k))) axis = 1;
      if (layout.shoot.some((k) => this.keys.has(k))) shootHeld = true;
    }

    return { axis: clamp(axis, -1, 1), shoot: shootHeld, start: false, back: false };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}