/**
 * Structural validation for a game-reported GameResult before the shell trusts
 * it. Match records are the immutable source of truth for all stats
 * (docs/ARCHITECTURE.md §7), so malformed structural fields (slot/rank/ids)
 * must be rejected at the boundary — once recorded they can never be repaired.
 *
 * Only the load-bearing shape is checked. The freeform `stats` / `gameStats`
 * maps stay unvalidated by design: the platform stores them verbatim.
 */
import type { GameResult } from "./types.js";

export interface GameResultExpectations {
  /** The manifest id of the launched game; result.gameId must match. */
  gameId?: string;
  /** The LaunchContext.sessionId of this match; result.sessionId must match. */
  sessionId?: string;
}

/**
 * Returns a list of problems with the result; empty means it is safe to record.
 * Pass `expected` to also enforce the contract that the result belongs to the
 * game and session the shell actually launched.
 */
export function validateGameResult(
  result: unknown,
  expected: GameResultExpectations = {},
): string[] {
  const errors: string[] = [];
  if (typeof result !== "object" || result === null) {
    return ["result must be an object"];
  }
  const r = result as Partial<GameResult>;

  if (typeof r.gameId !== "string" || r.gameId === "") {
    errors.push("gameId must be a non-empty string");
  } else if (expected.gameId !== undefined && r.gameId !== expected.gameId) {
    errors.push(`gameId "${r.gameId}" does not match the launched game "${expected.gameId}"`);
  }

  if (typeof r.sessionId !== "string" || r.sessionId === "") {
    errors.push("sessionId must be a non-empty string");
  } else if (expected.sessionId !== undefined && r.sessionId !== expected.sessionId) {
    errors.push(`sessionId "${r.sessionId}" does not match the launched session`);
  }

  if (!Number.isFinite(r.startedAt)) errors.push("startedAt must be a finite number");
  if (!Number.isFinite(r.endedAt)) errors.push("endedAt must be a finite number");

  if (!Array.isArray(r.standings) || r.standings.length === 0) {
    errors.push("standings must be a non-empty array");
    return errors;
  }

  r.standings.forEach((standing, i) => {
    if (typeof standing !== "object" || standing === null) {
      errors.push(`standings[${i}] must be an object`);
      return;
    }
    if (!Number.isInteger(standing.slot) || standing.slot < 0) {
      errors.push(`standings[${i}].slot must be a non-negative integer`);
    }
    if (typeof standing.profileId !== "string" && standing.profileId !== null) {
      errors.push(`standings[${i}].profileId must be a string or null`);
    }
    if (!Number.isInteger(standing.rank) || standing.rank < 1) {
      errors.push(`standings[${i}].rank must be an integer >= 1`);
    }
    if (standing.score !== undefined && !Number.isFinite(standing.score)) {
      errors.push(`standings[${i}].score must be a finite number when present`);
    }
  });

  return errors;
}
