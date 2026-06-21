import type { RaskullsMode } from "./types.js";

export interface HazardEffect {
  lethal: boolean;
  stunMs: number;
  bounceY: number;
  speedMultiplier: number;
  frenzyDrain: number;
  clearPowerup: boolean;
}

const RACE_HAZARD_EFFECT: HazardEffect = {
  lethal: false,
  stunMs: 180,
  bounceY: 230,
  speedMultiplier: 0.25,
  frenzyDrain: 24,
  clearPowerup: true,
};

const ARENA_HAZARD_EFFECT: HazardEffect = {
  lethal: true,
  stunMs: 0,
  bounceY: 0,
  speedMultiplier: 1,
  frenzyDrain: 0,
  clearPowerup: false,
};

export function hazardEffectForMode(mode: RaskullsMode): HazardEffect {
  return mode === "race" ? RACE_HAZARD_EFFECT : ARENA_HAZARD_EFFECT;
}
