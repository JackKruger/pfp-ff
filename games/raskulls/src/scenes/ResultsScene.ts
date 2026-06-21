import Phaser from "phaser";
import { buildGameResult } from "../systems/result.js";
import { session } from "../session.js";
import {
  advanceGrandPrixRound,
  hasNextGrandPrixRound,
  rankGrandPrix,
} from "../systems/playlist.js";

export class ResultsScene extends Phaser.Scene {
  private sent = false;

  constructor() {
    super("ResultsScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x111827);
    const completed = session.completed;
    const context = session.context;
    if (!completed || !context) {
      session.client.requestExit();
      return;
    }

    const grandPrix = session.grandPrix;
    const title = grandPrix
      ? completed.grandPrixFinal
        ? "Grand Prix Results"
        : `${completed.levelName ?? "Race"} Results`
      : completed.mode === "race"
        ? "Race Results"
        : "Arena Results";

    this.add.text(54, 42, title, {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "42px",
      fontStyle: "800",
      color: "#f8fafc",
    });

    const sorted = [...completed.ranked].sort((a, b) => a.rank - b.rank);
    sorted.forEach((standing, index) => {
      const player = context.players.find((candidate) => candidate.slot === standing.slot);
      const y = 132 + index * 74;
      const color = player?.color ?? "#e5e7eb";
      this.add.rectangle(72, y + 22, 30, 30, Phaser.Display.Color.HexStringToColor(color).color, 1);
      this.add.text(112, y, `${standing.rank}. ${player?.displayName ?? `P${standing.slot + 1}`}`, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "28px",
        fontStyle: "700",
        color: "#f8fafc",
      });
      this.add.text(510, y + 5, String(standing.score), {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "22px",
        color: "#cbd5e1",
      });
    });

    if (grandPrix && !completed.grandPrixFinal) {
      const standings = rankGrandPrix(grandPrix);
      this.add.text(54, 430, "Grand Prix Standings", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "20px",
        fontStyle: "700",
        color: "#facc15",
      });
      this.add.text(
        54,
        462,
        standings
          .map((standing) => {
            const player = context.players.find((candidate) => candidate.slot === standing.slot);
            return `${standing.rank}. ${player?.displayName ?? `P${standing.slot + 1}`} ${standing.score} pts`;
          })
          .join("   "),
        {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "16px",
          color: "#cbd5e1",
        },
      );
    }

    this.time.delayedCall(2400, () => this.sendResult());
  }

  override update(): void {
    const context = session.context;
    if (!context) return;
    session.input.tick();
    if (context.players.some((player) => session.input.actionsFor(player).justStart)) {
      this.sendResult();
    }
    session.input.commit();
  }

  private sendResult(): void {
    if (this.sent) return;
    const completed = session.completed;
    const context = session.context;
    if (!completed || !context) return;
    this.sent = true;

    const grandPrix = session.grandPrix;
    if (grandPrix && !completed.grandPrixFinal && hasNextGrandPrixRound(grandPrix)) {
      advanceGrandPrixRound(grandPrix);
      session.completed = null;
      this.scene.start("RaceScene");
      return;
    }

    session.client.gameOver(
      buildGameResult({
        sessionId: context.sessionId,
        startedAt: completed.startedAt,
        endedAt: completed.endedAt,
        mode: completed.mode,
        players: context.players,
        ranked: completed.ranked,
      }),
    );
  }
}
