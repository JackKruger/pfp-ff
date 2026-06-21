import type { GamepadState } from "@pfp/input";

export interface PlayerActions {
  moveX: number;
  moveY: number;
  jump: boolean;
  dig: boolean;
  power: boolean;
  start: boolean;
  back: boolean;
  justJump: boolean;
  justDig: boolean;
  justPower: boolean;
  justStart: boolean;
  justBack: boolean;
}

export interface PlayerKeyMapping {
  left: string;
  right: string;
  up: string;
  down: string;
  jump: string;
  dig: string;
  power: string;
  start: string;
  back: string;
}

export const KEYBOARD_MAPPINGS: PlayerKeyMapping[] = [
  {
    left: "KeyA",
    right: "KeyD",
    up: "KeyW",
    down: "KeyS",
    jump: "Space",
    dig: "ShiftLeft",
    power: "KeyE",
    start: "Enter",
    back: "Escape",
  },
  {
    left: "ArrowLeft",
    right: "ArrowRight",
    up: "ArrowUp",
    down: "ArrowDown",
    jump: "Numpad0",
    dig: "Numpad1",
    power: "Numpad2",
    start: "NumpadEnter",
    back: "Backspace",
  },
  {
    left: "KeyF",
    right: "KeyH",
    up: "KeyT",
    down: "KeyG",
    jump: "KeyY",
    dig: "KeyU",
    power: "KeyI",
    start: "Digit3",
    back: "KeyR",
  },
  {
    left: "KeyJ",
    right: "KeyL",
    up: "KeyI",
    down: "KeyK",
    jump: "KeyO",
    dig: "KeyP",
    power: "BracketLeft",
    start: "Digit4",
    back: "Semicolon",
  },
];

export interface NormalizeActionInput {
  gamepad: GamepadState | null;
  previousGamepad: GamepadState | null;
  keys: ReadonlySet<string>;
  previousKeys: ReadonlySet<string>;
  mapping: PlayerKeyMapping;
}

export function normalizeActions(input: NormalizeActionInput): PlayerActions {
  const { gamepad, previousGamepad, keys, previousKeys, mapping } = input;

  const keyDown = (code: string): boolean => keys.has(code);
  const prevKeyDown = (code: string): boolean => previousKeys.has(code);
  const padButton = (button: "a" | "b" | "x" | "y" | "rb" | "start" | "back"): boolean =>
    gamepad?.buttons[button] ?? false;
  const prevPadButton = (button: "a" | "b" | "x" | "y" | "rb" | "start" | "back"): boolean =>
    previousGamepad?.buttons[button] ?? false;

  const left = keyDown(mapping.left) || (gamepad?.buttons.left ?? false);
  const right = keyDown(mapping.right) || (gamepad?.buttons.right ?? false);
  const up = keyDown(mapping.up) || (gamepad?.buttons.up ?? false);
  const down = keyDown(mapping.down) || (gamepad?.buttons.down ?? false);

  const moveX = clampAxis((right ? 1 : 0) - (left ? 1 : 0) + clampAxis(gamepad?.axes.lx ?? 0));
  const moveY = clampAxis((down ? 1 : 0) - (up ? 1 : 0) + clampAxis(gamepad?.axes.ly ?? 0));

  const jump = keyDown(mapping.jump) || padButton("a");
  const dig = keyDown(mapping.dig) || padButton("x") || padButton("b");
  const power = keyDown(mapping.power) || padButton("y") || padButton("rb");
  const start = keyDown(mapping.start) || padButton("start");
  const back = keyDown(mapping.back) || padButton("back");

  const previousJump = prevKeyDown(mapping.jump) || prevPadButton("a");
  const previousDig = prevKeyDown(mapping.dig) || prevPadButton("x") || prevPadButton("b");
  const previousPower = prevKeyDown(mapping.power) || prevPadButton("y") || prevPadButton("rb");
  const previousStart = prevKeyDown(mapping.start) || prevPadButton("start");
  const previousBack = prevKeyDown(mapping.back) || prevPadButton("back");

  return {
    moveX,
    moveY,
    jump,
    dig,
    power,
    start,
    back,
    justJump: jump && !previousJump,
    justDig: dig && !previousDig,
    justPower: power && !previousPower,
    justStart: start && !previousStart,
    justBack: back && !previousBack,
  };
}

function clampAxis(value: number): number {
  if (value > 1) return 1;
  if (value < -1) return -1;
  return Math.abs(value) < 0.15 ? 0 : value;
}
