import { ARENAS } from "../arenas/index.js";
import type { GameState, PlayerFrame } from "../types.js";

const AXIS_THRESHOLD = 0.5;

/** Enter the pre-match arena picker, seeding the highlight from the current arena. */
export function beginLevelSelect(state: GameState): void {
  state.phase = "levelSelect";
  const found = ARENAS.findIndex((a) => a.id === state.arena.id);
  state.levelSelectIdx = found >= 0 ? found : 0;
  state.arena = ARENAS[state.levelSelectIdx];
  state.levelHeld = false;
}

/**
 * Pre-match arena picker. Any player can cycle the highlight (◄/► on the stick
 * or D-pad, or X/Y) and confirm with A. The live `state.arena` mirrors the
 * highlighted choice so the preview renders. Returns true once any player
 * confirms — the caller then seeds scorers and moves on to the intro.
 */
export function tickLevelSelect(state: GameState, frames: PlayerFrame[]): boolean {
  let idx = state.levelSelectIdx ?? 0;

  // Discrete X/Y edges step immediately (already edge-triggered upstream).
  for (const f of frames) {
    if (f.nextDown) idx++;
    if (f.prevDown) idx--;
  }

  // Analog/D-pad left-right, latched so one push moves one step.
  const dir = frames.reduce((d, f) => {
    if (f.moveX > AXIS_THRESHOLD) return 1;
    if (f.moveX < -AXIS_THRESHOLD) return -1;
    return d;
  }, 0);
  if (dir !== 0 && !state.levelHeld) {
    idx += dir;
    state.levelHeld = true;
  } else if (dir === 0) {
    state.levelHeld = false;
  }

  const n = ARENAS.length;
  idx = ((idx % n) + n) % n;
  state.levelSelectIdx = idx;
  state.arena = ARENAS[idx];

  return frames.some((f) => f.confirmDown);
}
