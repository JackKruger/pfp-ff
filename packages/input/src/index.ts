/**
 * @pfp/input — controller service: Gamepad API polling + normalization, the
 * "press A to join" pairing lobby, pad<->slot assignment, and hot-plug handling.
 * See §6. Implemented in Phase 3.
 */

/** Normalized Xbox-layout button/axis scheme that games and the menu read. */
export interface GamepadState {
  index: number;
  connected: boolean;
  buttons: {
    a: boolean;
    b: boolean;
    x: boolean;
    y: boolean;
    lb: boolean;
    rb: boolean;
    lt: number;
    rt: number;
    start: boolean;
    back: boolean;
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  };
  axes: { lx: number; ly: number; rx: number; ry: number };
}

// Phase 3: poller, edge-detection (justPressed/justReleased), pairing lobby, hot-plug.
