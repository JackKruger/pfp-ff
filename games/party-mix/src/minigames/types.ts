import type { PlayerInput } from "../game.js";

/** Lightweight view of a player handed to a minigame (no board/economy state). */
export interface MinigamePlayer {
  slot: number;
  name: string;
  color: string;
}

/**
 * A minigame is a self-contained mini-round. The board engine instantiates one,
 * pumps `update`/`render` each frame, polls `done()`, and reads `placements()`
 * (player indices, winner first) to pay out coins. New minigames only need to
 * implement this interface and register in registry.ts.
 */
export interface Minigame {
  readonly id: string;
  readonly name: string;
  /** One-line "how to win", shown on the intro card. */
  readonly rules: string;
  update(dtMs: number, inputs: PlayerInput[]): void;
  render(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  done(): boolean;
  /** Indices into the players array, best placement first. */
  placements(): number[];
}

export type MinigameFactory = (players: MinigamePlayer[]) => Minigame;

/** Coin reward by finishing position (1st, 2nd, 3rd, 4th). */
export const PAYOUT = [10, 6, 3, 0];

/** Edge-detect helper: returns A-press edges given current inputs and prior state. */
export function aEdges(inputs: PlayerInput[], prev: boolean[]): boolean[] {
  const edges = inputs.map((inp, i) => inp.a && !(prev[i] ?? false));
  for (let i = 0; i < inputs.length; i++) prev[i] = inputs[i]!.a;
  return edges;
}
