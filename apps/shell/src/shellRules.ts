import type { GameManifest } from "@pfp/sdk";
import type { GameEntry } from "./games.js";

export function canStartGame(joinedPlayers: number, minPlayers: number): boolean {
  return joinedPlayers >= minPlayers;
}

export function playableGamesMissingBuild(
  games: readonly GameEntry[],
  builtGameIds: readonly string[],
): string[] {
  const built = new Set(builtGameIds);
  return games
    .filter((game) => !game.disabled)
    .filter((game) => !built.has(game.id))
    .map((game) => game.id);
}

export function usesShellForwardedInput(game: Pick<GameManifest, "input">): boolean {
  return game.input?.mode === "forwarded" || game.input?.mode === "hybrid";
}
