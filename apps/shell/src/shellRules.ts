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

/**
 * Games that declare `build.desktopServer` need the Electron desktop shell
 * (apps/desktop) to spawn a local server process. In plain-browser mode
 * there is no bridge to do that, so the game can't be launched there.
 */
export function requiresDesktopBridge(game: Pick<GameManifest, "build">): boolean {
  return Boolean(game.build?.desktopServer);
}

export function isGameLaunchable(
  game: Pick<GameManifest, "build">,
  hasDesktopBridge: boolean,
): boolean {
  return !requiresDesktopBridge(game) || hasDesktopBridge;
}
