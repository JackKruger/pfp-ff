/**
 * @pfp/input — controller service: Gamepad API polling + normalization, the
 * "press A to join" pairing lobby, pad<->slot assignment, and hot-plug handling.
 * See docs/ARCHITECTURE.md §6.
 */
export * from "./types.js";
export * from "./normalize.js";
export * from "./source.js";
export * from "./poller.js";
export * from "./pairing.js";
