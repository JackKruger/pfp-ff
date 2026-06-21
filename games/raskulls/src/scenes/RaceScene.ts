import { createRaceLevel } from "../systems/levels.js";
import { rankRacePlayers } from "../systems/scoring.js";
import { PlayScene } from "./PlayScene.js";

export class RaceScene extends PlayScene {
  private finishX = 0;
  private timeoutMs = 0;

  constructor() {
    super("RaceScene", "race");
  }

  create(): void {
    const level = createRaceLevel();
    this.finishX = level.finishX;
    this.timeoutMs = level.timeoutMs;
    this.beginLevel({ grid: level.grid, starts: level.starts, lives: Number.POSITIVE_INFINITY });
  }

  override update(time: number, delta: number): void {
    this.updatePlay(time, delta);
    if (!this.players.length) return;

    for (const player of this.players) {
      if (!player.finished && player.alive && player.x + player.width >= this.finishX) {
        player.finished = true;
        player.stats.finishMs = Math.round(this.elapsedMs);
        player.vx = 0;
        player.vy = 0;
        player.view.setAlpha(0.65);
      }
    }

    const allFinished = this.players.every((player) => player.finished);
    if (allFinished || this.elapsedMs >= this.timeoutMs) {
      this.completeMatch(
        rankRacePlayers(
          this.players.map((player) => ({
            slot: player.slot,
            profileId: player.profileId,
            progress: Math.min(1000, Math.max(0, (player.x / this.finishX) * 1000)),
            stats: player.stats,
          })),
          this.timeoutMs,
        ),
      );
    }
  }

  protected hudText(): string {
    const remaining = Math.max(0, Math.ceil((this.timeoutMs - this.elapsedMs) / 1000));
    const rows = this.players.map(
      (player) =>
        `P${player.slot + 1} ${player.finished ? "FIN" : `${player.stats.gems}G ${player.stats.blocksBroken}B`}`,
    );
    return [`Race  ${remaining}s`, ...rows].join("\n");
  }
}
