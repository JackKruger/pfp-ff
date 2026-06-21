// Gamepad + keyboard input adapter for local multiplayer.
import type { PlayerInput } from "./player";

export interface GamepadBinding {
  gamepadIndex: number;
}

export interface KeyboardBinding {
  up: string;
  down: string;
  left: string;
  right: string;
  aimUp: string;
  aimDown: string;
  aimLeft: string;
  aimRight: string;
  block: string;
  sprint: string;
  jump: string;
  attack: string;
}

const KEYBOARD_PRESETS: KeyboardBinding[] = [
  {
    up: "w",
    down: "s",
    left: "a",
    right: "d",
    aimUp: "ArrowUp",
    aimDown: "ArrowDown",
    aimLeft: "ArrowLeft",
    aimRight: "ArrowRight",
    block: "f",
    sprint: "ShiftLeft",
    jump: " ",
    attack: "KeyE",
  },
  {
    up: "i",
    down: "k",
    left: "j",
    right: "l",
    aimUp: "KeyU",
    aimDown: "KeyJ",
    aimLeft: "KeyH",
    aimRight: "KeyK",
    block: "u",
    sprint: "o",
    jump: "p",
    attack: "KeyY",
  },
];

export class InputManager {
  private keys = new Set<string>();
  private gamepadBindings: Map<number, number> = new Map();
  private keyboardBindings: Map<number, number> = new Map();

  constructor() {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
  }

  bindGamepad(playerIndex: number, gamepadIndex: number) {
    this.gamepadBindings.set(playerIndex, gamepadIndex);
  }

  bindKeyboard(playerIndex: number, presetIndex = 0) {
    this.keyboardBindings.set(playerIndex, Math.min(presetIndex, KEYBOARD_PRESETS.length - 1));
  }

  getInput(playerIndex: number, playerYaw: number): PlayerInput {
    const gpIdx = this.gamepadBindings.get(playerIndex);
    let mv = { x: 0, y: 0 };
    let aimDX = 0,
      aimDY = 0;
    let block = false,
      sprint = false,
      jump = false;
    let attackTriggered = false;

    // Gamepad
    if (gpIdx !== undefined) {
      const pads = navigator.getGamepads();
      const pad = pads[gpIdx];
      if (pad) {
        const lsX = applyDeadzone(pad.axes[0] ?? 0, 0.15);
        const lsY = applyDeadzone(pad.axes[1] ?? 0, 0.15);
        mv.x = lsX;
        mv.y = -lsY;

        const rsX = applyDeadzone(pad.axes[2] ?? 0, 0.15);
        const rsY = applyDeadzone(pad.axes[3] ?? 0, 0.15);
        aimDX = rsX;
        aimDY = -rsY;

        block = pad.buttons[4]?.pressed || pad.buttons[6]?.value > 0.5;
        sprint = pad.buttons[5]?.pressed || pad.buttons[7]?.value > 0.5;
        jump = pad.buttons[0]?.pressed;
        attackTriggered = pad.buttons[1]?.pressed || pad.buttons[2]?.pressed; // B or X
      }
    }

    // Keyboard
    const kbIdx = this.keyboardBindings.get(playerIndex);
    let attackKeyHeld = false;
    if (kbIdx !== undefined) {
      const kb = KEYBOARD_PRESETS[kbIdx];
      if (this.keys.has(kb.up)) mv.y -= 1;
      if (this.keys.has(kb.down)) mv.y += 1;
      if (this.keys.has(kb.left)) mv.x -= 1;
      if (this.keys.has(kb.right)) mv.x += 1;
      if (this.keys.has(kb.aimUp)) aimDY -= 1;
      if (this.keys.has(kb.aimDown)) aimDY += 1;
      if (this.keys.has(kb.aimLeft)) aimDX -= 1;
      if (this.keys.has(kb.aimRight)) aimDX += 1;
      if (this.keys.has(kb.block)) block = true;
      if (this.keys.has(kb.sprint)) sprint = true;
      if (this.keys.has(kb.jump)) jump = true;
      attackKeyHeld = this.keys.has(kb.attack);
      if (attackKeyHeld) attackTriggered = true;
    }

    // Clamp mv
    const ml = Math.hypot(mv.x, mv.y);
    if (ml > 1) {
      mv.x /= ml;
      mv.y /= ml;
    }

    // Clamp aim and scale
    const aimMag = Math.hypot(aimDX, aimDY);
    if (aimMag > 1) {
      aimDX /= aimMag;
      aimDY /= aimMag;
    }

    // Detect attack type from aim direction + trigger
    let attackType: string | null = null;
    if (attackTriggered) {
      const adx = Math.abs(aimDX),
        ady = Math.abs(aimDY);
      if (ady > adx && aimDY < -0.3) attackType = "overhead";
      else if (ady > adx && aimDY > 0.3) attackType = "swing";
      else if (adx > ady && aimDX > 0.3) attackType = "swing";
      else if (adx > ady && aimDX < -0.3) attackType = "backhand";
      else attackType = "swing";
    }

    return {
      mv,
      yaw: playerYaw,
      pitch: 0,
      sprint,
      jump,
      blocking: block,
      swinging: true,
      attackType,
      aimDX,
      aimDY,
    };
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }
}

function applyDeadzone(v: number, dz: number): number {
  if (Math.abs(v) < dz) return 0;
  return ((Math.abs(v) - dz) / (1 - dz)) * Math.sign(v);
}
