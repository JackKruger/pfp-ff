import type { LaunchContext } from "@pfp/sdk";
import type { InputFrame, PlayerInput } from "./game.js";

const DEADZONE = 0.4;

/**
 * Keyboard layout per player index (dev fallback; on the couch everyone uses a
 * gamepad). Each player gets a confirm (A) and cancel (B) key plus a direction
 * pair, kept clear of the others.
 *   0: A=Space  B=LShift   dir = WASD
 *   1: A=Enter  B=Backspace dir = arrows
 *   2: A=Numpad0 B=NumpadDecimal dir = Numpad 8/5/4/6
 *   3: A=Tab    B=`        dir = IJKL
 */
interface Layout {
  a: string[];
  b: string[];
  up: string[];
  down: string[];
  left: string[];
  right: string[];
}

const KEY_LAYOUTS: Layout[] = [
  { a: [" "], b: ["Shift"], up: ["w", "W"], down: ["s", "S"], left: ["a", "A"], right: ["d", "D"] },
  {
    a: ["Enter"],
    b: ["Backspace"],
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
  },
  {
    a: ["Numpad0"],
    b: ["NumpadDecimal"],
    up: ["Numpad8"],
    down: ["Numpad5", "Numpad2"],
    left: ["Numpad4"],
    right: ["Numpad6"],
  },
  { a: ["Tab"], b: ["`"], up: ["i", "I"], down: ["k", "K"], left: ["j", "J"], right: ["l", "L"] },
];

const START_KEYS = new Set(["Enter", "NumpadEnter"]);
const ALL_GAME_KEYS = new Set<string>();
for (const l of KEY_LAYOUTS) {
  for (const k of [...l.a, ...l.b, ...l.up, ...l.down, ...l.left, ...l.right]) ALL_GAME_KEYS.add(k);
}
for (const k of START_KEYS) ALL_GAME_KEYS.add(k);

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
    for (let i = 0; i < players.length; i++) {
      inputs.push(this.readPlayer(players[i]!.gamepadIndex, i));
    }

    const kbStart = [...START_KEYS].some((k) => this.keys.has(k));
    let padStart = false;
    for (const p of players) {
      const pad = navigator.getGamepads?.()[p.gamepadIndex] ?? null;
      if (pad?.buttons[9]?.pressed) padStart = true;
    }
    const startNow = kbStart || padStart;
    const anyStart = startNow && !this.prevStartGlobal;
    this.prevStartGlobal = startNow;

    return { inputs, anyStart };
  }

  private readPlayer(padIndex: number, playerIdx: number): PlayerInput {
    let a = false;
    let b = false;
    let dx = 0;
    let dy = 0;

    const pad = navigator.getGamepads?.()[padIndex] ?? null;
    if (pad) {
      a = pad.buttons[0]?.pressed ?? false; // A
      b = pad.buttons[1]?.pressed ?? false; // B
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (Math.abs(ax) >= DEADZONE) dx = Math.sign(ax);
      if (Math.abs(ay) >= DEADZONE) dy = Math.sign(ay);
      if (pad.buttons[14]?.pressed) dx = -1; // d-pad left
      if (pad.buttons[15]?.pressed) dx = 1; // d-pad right
      if (pad.buttons[12]?.pressed) dy = -1; // d-pad up
      if (pad.buttons[13]?.pressed) dy = 1; // d-pad down
    }

    const layout = KEY_LAYOUTS[playerIdx];
    if (layout) {
      if (layout.a.some((k) => this.keys.has(k))) a = true;
      if (layout.b.some((k) => this.keys.has(k))) b = true;
      if (layout.left.some((k) => this.keys.has(k))) dx = -1;
      if (layout.right.some((k) => this.keys.has(k))) dx = 1;
      if (layout.up.some((k) => this.keys.has(k))) dy = -1;
      if (layout.down.some((k) => this.keys.has(k))) dy = 1;
    }

    return { a, b, dx, dy };
  }
}
