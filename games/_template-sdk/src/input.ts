export interface PlayerInput {
  moveX: number;
  moveY: number;
  primary: boolean;
  start: boolean;
  back: boolean;
}

export class DirectInputReader {
  private readonly keys = new Set<string>();
  private readonly onKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.code);
  };
  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  sample(gamepadIndex: number): PlayerInput {
    const pad = gamepadIndex >= 0 ? navigator.getGamepads()[gamepadIndex] : null;
    const keyboard = this.keyboardInput();
    if (!pad) return keyboard;

    return {
      moveX: axisWithButtons(pad.axes[0] ?? 0, pressed(pad, 15), pressed(pad, 14)),
      moveY: axisWithButtons(pad.axes[1] ?? 0, pressed(pad, 13), pressed(pad, 12)),
      primary: pressed(pad, 0) || keyboard.primary,
      start: pressed(pad, 9) || keyboard.start,
      back: pressed(pad, 1) || keyboard.back,
    };
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private keyboardInput(): PlayerInput {
    const right = this.keys.has("ArrowRight") || this.keys.has("KeyD");
    const left = this.keys.has("ArrowLeft") || this.keys.has("KeyA");
    const down = this.keys.has("ArrowDown") || this.keys.has("KeyS");
    const up = this.keys.has("ArrowUp") || this.keys.has("KeyW");
    return {
      moveX: Number(right) - Number(left),
      moveY: Number(down) - Number(up),
      primary: this.keys.has("Space") || this.keys.has("Enter"),
      start: this.keys.has("Enter"),
      back: this.keys.has("Escape"),
    };
  }
}

function pressed(pad: Gamepad, button: number): boolean {
  return Boolean(pad.buttons[button]?.pressed);
}

function axisWithButtons(axis: number, positive: boolean, negative: boolean): number {
  const digital = Number(positive) - Number(negative);
  if (digital !== 0) return digital;
  return Math.abs(axis) < 0.18 ? 0 : axis;
}
