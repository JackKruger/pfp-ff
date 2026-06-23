const NEUTRAL_SNAPSHOT = Object.freeze({
  moveX: 0,
  moveY: 0,
  jump: false,
  attack: false,
  grab: false,
  special: false,
  throw: false,
  aimX: 0,
  aimY: 0,
  aimActive: false,
});

export function neutralPfpSnapshot() {
  return { ...NEUTRAL_SNAPSHOT };
}

export class PfpControls {
  constructor(source) {
    this.source = source;
  }

  getSnapshotForSlot(slot) {
    const frame = this.source.getLatestFrame?.();
    const player = frame?.players?.find((candidate) => candidate.slot === slot);
    if (!player) return neutralPfpSnapshot();

    const actions = player.actions ?? {};
    const aimX = actions.aimX?.value ?? 0;
    const aimY = actions.aimY?.value ?? 0;

    return {
      moveX: actions.moveX?.value ?? 0,
      moveY: actions.moveY?.value ?? 0,
      jump: actions.jump?.pressed ?? false,
      attack: actions.attack?.pressed ?? false,
      grab: actions.grab?.pressed ?? false,
      special: actions.special?.pressed ?? false,
      throw: actions.throw?.pressed ?? false,
      aimX,
      aimY,
      aimActive: Math.hypot(aimX, aimY) > 0.35,
    };
  }
}
