import { session } from "../session.js";
import {
  applyChallengeEvent,
  challengeDefinition,
  createChallengeRuntime,
  rankChallengePlayers,
  type ChallengeRuntime,
} from "../systems/challenges.js";
import { createRaceLevel } from "../systems/levels.js";
import type { PickupKind } from "../systems/terrain.js";
import type { PlayPlayer } from "./PlayScene.js";
import { PlayScene } from "./PlayScene.js";

export class ChallengeScene extends PlayScene {
  private runtime!: ChallengeRuntime;
  private finishX = 0;
  private timeoutMs = 0;

  constructor() {
    super("ChallengeScene", "race");
  }

  create(): void {
    const context = session.context;
    if (!context) {
      session.client.requestExit();
      return;
    }

    this.runtime =
      session.challenge ??
      createChallengeRuntime(challengeDefinition("time-trial").id, context.players);
    session.challenge = this.runtime;

    const level = createRaceLevel(this.runtime.definition.levelId);
    this.finishX = level.finishX;
    this.timeoutMs = this.runtime.definition.timeLimitMs;
    for (const target of this.runtime.definition.bombTargetTiles ?? []) {
      level.grid.set(target.tileX, target.tileY, "bomb");
    }

    this.beginLevel({ grid: level.grid, starts: level.starts, lives: Number.POSITIVE_INFINITY });
  }

  override update(time: number, delta: number): void {
    this.updatePlay(time, delta);
    if (!this.players.length) return;

    for (const player of this.players) {
      if (player.frenzyActive) {
        applyChallengeEvent(this.runtime, {
          type: "frenzy-uptime",
          slot: player.slot,
          deltaMs: delta,
        });
      }

      if (!player.finished && player.alive && player.x + player.width >= this.finishX) {
        player.finished = true;
        player.stats.finishMs = Math.round(this.elapsedMs);
        player.vx = 0;
        player.vy = 0;
        player.view.setAlpha(0.65);
      }
    }

    if (this.players.every((player) => player.finished) || this.elapsedMs >= this.timeoutMs) {
      this.completeChallenge();
    }
  }

  protected override canDig(player: PlayPlayer): boolean {
    const runtime = this.playerRuntime(player.slot);
    return runtime ? runtime.wandUsesRemaining > 0 : true;
  }

  protected override onSuccessfulDig(player: PlayPlayer): void {
    if (this.runtime.definition.wandLimit !== undefined) {
      applyChallengeEvent(this.runtime, { type: "wand-used", slot: player.slot });
    }
  }

  protected override onPickupCollected(player: PlayPlayer, pickup: PickupKind): void {
    if (this.runtime.definition.id === "bomb-disposal" && pickup === "bomb") {
      applyChallengeEvent(this.runtime, { type: "bomb-target-cleared", slot: player.slot });
    }
  }

  protected hudText(): string {
    const remaining = Math.max(0, Math.ceil((this.timeoutMs - this.elapsedMs) / 1000));
    const rows = this.players.map((player) => {
      const runtime = this.playerRuntime(player.slot);
      if (this.runtime.definition.id === "ammo-scrooge") {
        return `P${player.slot + 1} ${runtime?.wandUsesRemaining ?? 0}W`;
      }
      if (this.runtime.definition.id === "bomb-disposal") {
        return `P${player.slot + 1} ${runtime?.bombTargetsCleared ?? 0}/${this.runtime.definition.bombTargetCount ?? 0}B`;
      }
      if (this.runtime.definition.id === "frenzy-run") {
        return `P${player.slot + 1} ${Math.round((runtime?.frenzyUptimeMs ?? 0) / 1000)}F`;
      }
      return `P${player.slot + 1} ${player.finished ? "FIN" : `${Math.round((player.x / this.finishX) * 100)}%`}`;
    });
    return [`${this.runtime.definition.name}  ${remaining}s`, ...rows].join("\n");
  }

  private completeChallenge(): void {
    this.completeMatch(
      rankChallengePlayers(
        this.runtime.definition.id,
        this.players.map((player) => {
          const runtime = this.playerRuntime(player.slot);
          return {
            slot: player.slot,
            profileId: player.profileId,
            stats: player.stats,
            wandUsesRemaining: runtime?.wandUsesRemaining,
            bombTargetsCleared: runtime?.bombTargetsCleared,
            frenzyUptimeMs: runtime?.frenzyUptimeMs,
          };
        }),
      ),
      { levelName: this.runtime.definition.name },
    );
  }

  private playerRuntime(slot: number) {
    return this.runtime.players.find((player) => player.slot === slot);
  }
}
