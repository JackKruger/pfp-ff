import type { GameResult } from "@pfp/sdk";

export async function recordMatchBestEffort(
  result: GameResult,
  recordMatch: (result: GameResult) => Promise<void>,
  onError: (error: unknown) => void = console.error,
): Promise<void> {
  try {
    await recordMatch(result);
  } catch (error) {
    onError(error);
  }
}
