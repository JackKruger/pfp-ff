import type { DigitalButton, GamepadState } from "@pfp/input";
import type {
  ControlActionState,
  ControlButton,
  ControlButtonState,
  ControlFrame,
  ControlPlayerFrame,
  GameActionBinding,
  GameInputSource,
  PlayerSlot,
} from "@pfp/sdk";
import type { ControlSchema } from "./schema.js";

type ButtonInputSource = Extract<GameInputSource, ControlButton>;

export interface ControlPoller {
  getState(index: number): GamepadState | null;
  pressed(index: number, button: DigitalButton): boolean;
  justPressed(index: number, button: DigitalButton): boolean;
  justReleased(index: number, button: DigitalButton): boolean;
  trigger(index: number, which: "lt" | "rt"): number;
}

export interface CreateControlFrameOptions {
  seq: number;
  now: number;
  dtMs: number;
  paused: boolean;
  players: readonly PlayerSlot[];
  poller: ControlPoller;
  /**
   * Optional fallback source keyed by player *slot* (not gamepad index). Used
   * for any slot whose gamepad is disconnected, so a real controller always
   * wins over the keyboard.
   */
  keyboard?: ControlPoller;
  schema?: ControlSchema;
}

/** The input source a player frame is actually read from this tick. */
interface ResolvedSource {
  poller: ControlPoller;
  index: number;
  label: "gamepad" | "keyboard";
}

const CONTROL_BUTTONS: readonly ControlButton[] = [
  "a",
  "b",
  "x",
  "y",
  "lb",
  "rb",
  "lt",
  "rt",
  "start",
  "back",
  "up",
  "down",
  "left",
  "right",
];

const DIGITAL_CONTROL_BUTTONS = new Set<ControlButton>([
  "a",
  "b",
  "x",
  "y",
  "lb",
  "rb",
  "start",
  "back",
  "up",
  "down",
  "left",
  "right",
]);

export function createControlFrame(options: CreateControlFrameOptions): ControlFrame {
  return {
    seq: options.seq,
    now: options.now,
    dtMs: options.dtMs,
    paused: options.paused,
    players: options.players.map((player) =>
      createPlayerFrame(player, options.poller, options.schema ?? { actions: {} }, options.keyboard),
    ),
  };
}

/** Pick the gamepad if connected, else the keyboard fallback for this slot. */
function resolveSource(
  player: PlayerSlot,
  poller: ControlPoller,
  keyboard: ControlPoller | undefined,
): ResolvedSource | null {
  if (player.gamepadIndex >= 0 && poller.getState(player.gamepadIndex)?.connected) {
    return { poller, index: player.gamepadIndex, label: "gamepad" };
  }
  if (keyboard?.getState(player.slot)?.connected) {
    return { poller: keyboard, index: player.slot, label: "keyboard" };
  }
  return null;
}

function createPlayerFrame(
  player: PlayerSlot,
  poller: ControlPoller,
  schema: ControlSchema,
  keyboard: ControlPoller | undefined,
): ControlPlayerFrame {
  const source = resolveSource(player, poller, keyboard);
  const state = source ? source.poller.getState(source.index) : null;
  const buttons = buildButtonStates(source);

  return {
    slot: player.slot,
    profileId: player.profileId,
    connected: source !== null,
    source: source?.label ?? "none",
    axes: {
      moveX: state?.axes.lx ?? 0,
      moveY: state?.axes.ly ?? 0,
      aimX: state?.axes.rx ?? 0,
      aimY: state?.axes.ry ?? 0,
      throttle: (buttons.rt?.value ?? 0) - (buttons.lt?.value ?? 0),
    },
    buttons,
    actions: buildActionStates(source, schema.actions),
  };
}

function buildButtonStates(
  source: ResolvedSource | null,
): Record<ControlButton, ControlButtonState> {
  const states = {} as Record<ControlButton, ControlButtonState>;
  for (const button of CONTROL_BUTTONS) {
    states[button] = source
      ? controlButtonState(source.index, button, source.poller)
      : releasedButton();
  }
  return states;
}

function buildActionStates(
  source: ResolvedSource | null,
  actions: Record<string, GameActionBinding[]>,
): Record<string, ControlActionState> {
  const result: Record<string, ControlActionState> = {};
  for (const [action, bindings] of Object.entries(actions)) {
    result[action] = source
      ? combineBindings(source.index, bindings, source.poller)
      : releasedButton();
  }
  return result;
}

function combineBindings(
  gamepadIndex: number,
  bindings: readonly GameActionBinding[],
  poller: ControlPoller,
): ControlActionState {
  let value = 0;
  let pressed = false;
  let justPressed = false;
  let justReleased = false;

  for (const binding of bindings) {
    const next = sourceState(gamepadIndex, binding, poller);
    if (Math.abs(next.value) > Math.abs(value)) value = next.value;
    pressed ||= next.pressed;
    justPressed ||= next.justPressed;
    justReleased ||= next.justReleased;
  }

  return { pressed, justPressed, justReleased, value };
}

function sourceState(
  gamepadIndex: number,
  binding: GameActionBinding,
  poller: ControlPoller,
): ControlActionState {
  const raw = rawSourceValue(gamepadIndex, binding.source, poller);
  const deadzone = binding.deadzone ?? 0;
  const value = Math.abs(raw.value) < deadzone ? 0 : clamp(raw.value * (binding.scale ?? 1));

  return {
    pressed: Math.abs(value) >= 0.5,
    justPressed: raw.justPressed,
    justReleased: raw.justReleased,
    value,
  };
}

function rawSourceValue(
  gamepadIndex: number,
  source: GameInputSource,
  poller: ControlPoller,
): ControlActionState {
  if (isButtonInputSource(source)) return controlButtonState(gamepadIndex, source, poller);

  const state = poller.getState(gamepadIndex);
  switch (source) {
    case "leftStickX":
      return axisState(state?.axes.lx ?? 0);
    case "leftStickY":
      return axisState(state?.axes.ly ?? 0);
    case "rightStickX":
      return axisState(state?.axes.rx ?? 0);
    case "rightStickY":
      return axisState(state?.axes.ry ?? 0);
    case "dpadX":
      return axisState(
        (poller.pressed(gamepadIndex, "right") ? 1 : 0) -
          (poller.pressed(gamepadIndex, "left") ? 1 : 0),
      );
    case "dpadY":
      return axisState(
        (poller.pressed(gamepadIndex, "down") ? 1 : 0) -
          (poller.pressed(gamepadIndex, "up") ? 1 : 0),
      );
  }
}

function controlButtonState(
  gamepadIndex: number,
  button: ControlButton,
  poller: ControlPoller,
): ControlButtonState {
  if (button === "lt" || button === "rt") {
    const value = poller.trigger(gamepadIndex, button);
    return {
      pressed: value >= 0.5,
      justPressed: false,
      justReleased: false,
      value,
    };
  }

  if (!DIGITAL_CONTROL_BUTTONS.has(button)) return releasedButton();
  const digital = button as DigitalButton;
  return {
    pressed: poller.pressed(gamepadIndex, digital),
    justPressed: poller.justPressed(gamepadIndex, digital),
    justReleased: poller.justReleased(gamepadIndex, digital),
    value: poller.pressed(gamepadIndex, digital) ? 1 : 0,
  };
}

function isButtonInputSource(source: GameInputSource): source is ButtonInputSource {
  return (CONTROL_BUTTONS as readonly string[]).includes(source);
}

function releasedButton(): ControlButtonState {
  return {
    pressed: false,
    justPressed: false,
    justReleased: false,
    value: 0,
  };
}

function axisState(value: number): ControlActionState {
  const clamped = clamp(value);
  return {
    pressed: Math.abs(clamped) >= 0.5,
    justPressed: false,
    justReleased: false,
    value: clamped,
  };
}

function clamp(value: number): number {
  return value < -1 ? -1 : value > 1 ? 1 : value;
}
