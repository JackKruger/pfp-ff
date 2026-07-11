/**
 * Adapts shell launches, forwarded input, and match completion onto upstream
 * Stick Smash's external-host hooks (`pfp/external-host-hooks` branch) without
 * editing upstream files. Upstream is an untyped submodule, so the `Game`
 * surface used here is a structural contract (`ExternalHostGame`).
 */
import type { LaunchContext } from "@pfp/sdk";
import type { PfpControls } from "../input/PfpControls.js";
import type { StickSmashPlayer } from "./results.js";

const PFP_INPUT_KIND = "pfp";
const DEFAULT_LEVEL_ID = "arena";
const MIN_FIGHTERS = 2;

export interface ExternalMatchResult {
  external?: boolean;
  context: LaunchContext;
  startedAt: number;
  endedAt: number;
  winner: StickSmashPlayer | null | undefined;
  players: (StickSmashPlayer | null | undefined)[];
  reason?: string;
}

interface ExternalMatchGamePlayer extends StickSmashPlayer {
  pfpProfileId?: string | null;
}

/** The upstream `Game` hooks this adapter installs into / drives. */
export interface ExternalHostGame {
  input: {
    registerInputProvider(
      kind: string,
      provider: { getSnapshotFor(source: { slot: number }): unknown },
    ): void;
  };
  players: (ExternalMatchGamePlayer | null | undefined)[];
  onMatchOver?: (result: ExternalMatchResult) => boolean;
  startPfpMatch?: (context: LaunchContext) => void;
  startExternalMatch(options: {
    context: LaunchContext;
    levelId: string;
    minFighters: number;
    bodyClass: string;
    players: {
      name: string;
      slot: number;
      inputSource: { kind: string; slot: number };
      metadata: { profileId: string | null; shellIndex: number };
    }[];
  }): void;
}

export interface ExternalMatchHooks {
  controls: PfpControls;
  onGameOver?: (outcome: {
    context: LaunchContext;
    startedAt: number;
    endedAt: number;
    winner: StickSmashPlayer | null | undefined;
    players: (StickSmashPlayer | null | undefined)[];
    reason?: string;
  }) => void;
}

export function installPfpExternalMatch(
  game: ExternalHostGame,
  { controls, onGameOver }: ExternalMatchHooks,
): void {
  game.input.registerInputProvider(PFP_INPUT_KIND, {
    getSnapshotFor: (source) => controls.getSnapshotForSlot(source.slot),
  });

  game.onMatchOver = (result) => {
    if (!result.external) return false;
    onGameOver?.({
      context: result.context,
      startedAt: result.startedAt,
      endedAt: result.endedAt,
      winner: result.winner,
      players: result.players,
      reason: result.reason,
    });
    return true;
  };

  game.startPfpMatch = (context) => {
    game.startExternalMatch({
      context,
      levelId: levelIdFrom(context) ?? DEFAULT_LEVEL_ID,
      minFighters: MIN_FIGHTERS,
      bodyClass: "pfp-mode",
      players: (context.players ?? []).map((player, index) => ({
        name: player.displayName || `P${player.slot + 1}`,
        slot: player.slot,
        inputSource: { kind: PFP_INPUT_KIND, slot: player.slot },
        metadata: {
          profileId: player.profileId,
          shellIndex: index,
        },
      })),
    });

    for (const player of game.players) {
      const slot =
        player?.inputSource != null && isPfpInputSource(player.inputSource)
          ? player.inputSource.slot
          : null;
      if (player == null || slot == null) continue;
      const shellPlayer = (context.players ?? []).find((candidate) => candidate.slot === slot);
      player.pfpSlot = slot;
      player.pfpProfileId = shellPlayer?.profileId;
    }
  };
}

function isPfpInputSource(source: { slot?: number } & { kind?: string }): boolean {
  return source.kind === PFP_INPUT_KIND;
}

function levelIdFrom(context: LaunchContext): string | null {
  const levelId = context.settings?.levelId;
  return typeof levelId === "string" && levelId !== "" ? levelId : null;
}
