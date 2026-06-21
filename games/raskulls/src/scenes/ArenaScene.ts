import { createArenaLevel } from "../systems/levels.js";
import { rankArenaPlayers } from "../systems/scoring.js";
import { PlayScene } from "./PlayScene.js";

export class ArenaScene extends PlayScene {
  private durationMs = 0;

  constructor() {
    super("ArenaScene", "arena");
  }

  create(): void {
    const level = createArenaLevel();
    this.durationMs = level.durationMs;
    this.beginLevel({ grid: level.grid, starts: level.starts, lives: level.lives });
  }

  override update(time: number, delta: number): void {
    this.updatePlay(time, delta);
    if (!this.players.length) return;

    const standing = this.players.filter((player) => player.lives > 0);
    if (standing.length <= 1 || this.elapsedMs >= this.durationMs) {
      this.completeMatch(
        rankArenaPlayers(
          this.players.map((player) => ({
            slot: player.slot,
            profileId: player.profileId,
            lives: player.lives,
            alive: player.lives > 0,
            stats: player.stats,
          })),
        ),
      );
    }
  }

  protected hudText(): string {
    const remaining = Math.max(0, Math.ceil((this.durationMs - this.elapsedMs) / 1000));
    const rows = this.players.map(
      (player) =>
        `P${player.slot + 1} ${player.lives}L ${player.stats.eliminations}K ${player.stats.gems}G`,
    );
    return [`Arena  ${remaining}s`, ...rows].join("\n");
  }
}
