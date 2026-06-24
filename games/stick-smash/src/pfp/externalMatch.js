const PFP_INPUT_KIND = 'pfp';
const DEFAULT_LEVEL_ID = 'arena';
const MIN_FIGHTERS = 2;

export function installPfpExternalMatch(game, { controls, onGameOver }) {
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
      levelId: context.settings?.levelId || DEFAULT_LEVEL_ID,
      minFighters: MIN_FIGHTERS,
      bodyClass: 'pfp-mode',
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
      const slot = player?.inputSource?.kind === PFP_INPUT_KIND ? player.inputSource.slot : null;
      if (slot == null) continue;
      const shellPlayer = (context.players ?? []).find((candidate) => candidate.slot === slot);
      player.pfpSlot = slot;
      player.pfpProfileId = shellPlayer?.profileId;
    }
  };
}
