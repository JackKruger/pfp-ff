import type { MinigameFactory } from "./types.js";
import { quickdraw } from "./quickdraw.js";
import { tugOfWar } from "./tug-of-war.js";
import { coinGrab } from "./coin-grab.js";

/** All playable minigames. Add a factory here to put a new one in rotation. */
export const MINIGAMES: MinigameFactory[] = [quickdraw, tugOfWar, coinGrab];

/** Picks a random minigame factory. */
export function pickMinigame(): MinigameFactory {
  return MINIGAMES[Math.floor(Math.random() * MINIGAMES.length)]!;
}
