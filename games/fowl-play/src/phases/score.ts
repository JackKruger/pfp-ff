import { SCORE_MS } from "../constants.js";
import type { GameState, RoundLog } from "../types.js";

/** Start showing the round results banner. */
export function beginScore(state: GameState, log: RoundLog): void {
  state.phase = "score";
  state.phaseTimer = SCORE_MS;
  state.lastRound = log;
  state.history.push(log);
}

/** Advances the score phase; returns true when it's time for the next phase. */
export function tickScore(state: GameState, dtMs: number): boolean {
  state.phaseTimer = Math.max(0, state.phaseTimer - dtMs);
  return state.phaseTimer <= 0;
}

/** True if anyone has met the win condition (state.config.winScore). */
export function matchIsOver(state: GameState): boolean {
  return state.players.some((p) => p.score.finalScore >= state.config.winScore);
}

/**
 * Resolve the final standings.
 * Order: score desc → coins desc → finishes desc → slot asc. Players with
 * identical sort keys share a rank.
 */
export function computeStandings(state: GameState): { slot: number; rank: number }[] {
  const sorted = [...state.players].sort((a, b) => {
    if (b.score.finalScore !== a.score.finalScore)
      return b.score.finalScore - a.score.finalScore;
    if (b.score.coinsCollected !== a.score.coinsCollected)
      return b.score.coinsCollected - a.score.coinsCollected;
    if (b.score.finishes !== a.score.finishes)
      return b.score.finishes - a.score.finishes;
    return a.slot - b.slot;
  });
  const out: { slot: number; rank: number }[] = [];
  let rank = 0;
  let lastKey: string | null = null;
  let idx = 0;
  for (const p of sorted) {
    idx++;
    const key = `${p.score.finalScore}|${p.score.coinsCollected}|${p.score.finishes}`;
    if (key !== lastKey) {
      rank = idx;
      lastKey = key;
    }
    out.push({ slot: p.slot, rank });
  }
  return out;
}
