/**
 * Maps shell-forwarded control frames (`@pfp/controls`) to the input snapshot
 * shape upstream Stick Smash expects from an input provider.
 */
import type { ControlFrame } from "@pfp/sdk";

export interface StickSmashInputSnapshot {
  moveX: number;
  moveY: number;
  jump: boolean;
  attack: boolean;
  grab: boolean;
  special: boolean;
  throw: boolean;
  aimX: number;
  aimY: number;
  aimActive: boolean;
}

/** The slice of a ControlClient the adapter needs (structural, for tests). */
export interface PfpFrameSource {
  getLatestFrame?: () => ControlFrame | null;
}

const NEUTRAL_SNAPSHOT: Readonly<StickSmashInputSnapshot> = Object.freeze({
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

export function neutralPfpSnapshot(): StickSmashInputSnapshot {
  return { ...NEUTRAL_SNAPSHOT };
}

export class PfpControls {
  constructor(private readonly source: PfpFrameSource) {}

  getSnapshotForSlot(slot: number): StickSmashInputSnapshot {
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
