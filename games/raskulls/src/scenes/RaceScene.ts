import { session } from "../session.js";

const LEVEL_QUIPS: Record<string, string> = {
  "dig-rush": "Dig Rush: First skull to the bottom wins... probably.",
  "cliff-climb": "Cliff Climb: Up is the only way out. Mostly.",
  "gray-gambit": "Gray Gambit: Chain those grays — or let someone else clean up.",
};
import { createRaceLevel } from "../systems/levels.js";
import {
  applyGrandPrixRound,
  currentGrandPrixLevelId,
  hasNextGrandPrixRound,
  rankGrandPrix,
} from "../systems/playlist.js";
import { rankRacePlayers } from "../systems/scoring.js";
import { PlayScene } from "./PlayScene.js";

export class RaceScene extends PlayScene {
  private levelName = "";
  private finishX = 0;
  private timeoutMs = 0;

  constructor() {
    super("RaceScene", "race");
  }

  create(): void {
    const grandPrix = session.grandPrix;
    const level = createRaceLevel(grandPrix ? currentGrandPrixLevelId(grandPrix) : undefined);
    this.levelName = level.name;
    this.finishX = level.finishX;
    this.timeoutMs = level.timeoutMs;
    this.beginLevel({ grid: level.grid, starts: level.starts, lives: Number.POSITIVE_INFINITY });
    this.showPreRaceOverlay(level.name, LEVEL_QUIPS[level.id] ?? "Dig fast or dig last.");
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
      this.completeRace();
    }
  }

  protected hudText(): string {
    const remaining = Math.max(0, Math.ceil((this.timeoutMs - this.elapsedMs) / 1000));
    const rows = this.players.map(
      (player) =>
        `P${player.slot + 1} ${
          player.finished
            ? "FIN"
            : `${player.stats.gems}G ${player.stats.blocksBroken}B ${Math.round(player.frenzyEnergy)}F`
        }`,
    );
    return [`${this.levelName}  ${remaining}s`, ...rows].join("\n");
  }

  private completeRace(): void {
    const ranked = rankRacePlayers(
      this.players.map((player) => ({
        slot: player.slot,
        profileId: player.profileId,
        progress: Math.min(1000, Math.max(0, (player.x / this.finishX) * 1000)),
        stats: player.stats,
      })),
      this.timeoutMs,
    );

    const grandPrix = session.grandPrix;
    if (!grandPrix) {
      this.completeMatch(ranked);
      return;
    }

    applyGrandPrixRound(grandPrix, ranked);
    const final = !hasNextGrandPrixRound(grandPrix);
    this.completeMatch(final ? rankGrandPrix(grandPrix) : ranked, {
      levelName: this.levelName,
      grandPrixFinal: final,
    });
  }
}
