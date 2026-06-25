import Phaser from "phaser";
import { buildGameResult } from "../systems/result.js";
import { session } from "../session.js";
import {
  advanceGrandPrixRound,
  hasNextGrandPrixRound,
  rankGrandPrix,
} from "../systems/playlist.js";

const WIN_QUIPS = [
  "Dug faster, won harder.",
  "The blocks never stood a chance.",
  "Bones are for the losers.",
  "First to the finish, first in our hearts.",
  "Skulls out, glory in.",
  "Speed is a state of mind. A very fast mind.",
];

const RIVAL_QUIPS = [
  "{winner} barely edged out {loser}.",
  "{winner} and {loser} nearly cracked the same skull.",
  "A whisker of bone separated {winner} from {loser}.",
];

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

    // Winner quip
    const winner = sorted[0];
    const runnerUp = sorted[1];
    if (winner) {
      const winnerPlayer = context.players.find((p) => p.slot === winner.slot);
      const winnerName = winnerPlayer?.displayName ?? `P${winner.slot + 1}`;
      const quipIndex = (winner.slot + completed.startedAt) % WIN_QUIPS.length;
      const quip = WIN_QUIPS[quipIndex] ?? WIN_QUIPS[0]!;
      this.add.text(112, 132 - 26, quip, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "15px",
        fontStyle: "italic",
        color: "#facc15",
      });

      // Rivalry blurb for close finishes (within 2s)
      if (
        runnerUp &&
        winner.stats.finishMs !== undefined &&
        runnerUp.stats.finishMs !== undefined &&
        Math.abs(winner.stats.finishMs - runnerUp.stats.finishMs) <= 2000
      ) {
        const loserPlayer = context.players.find((p) => p.slot === runnerUp.slot);
        const loserName = loserPlayer?.displayName ?? `P${runnerUp.slot + 1}`;
        const rivalIdx = winner.slot % RIVAL_QUIPS.length;
        const rivalQuip = (RIVAL_QUIPS[rivalIdx] ?? RIVAL_QUIPS[0]!)
          .replace("{winner}", winnerName)
          .replace("{loser}", loserName);
        this.add.text(54, 132 + sorted.length * 74 + 12, rivalQuip, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "17px",
          fontStyle: "italic",
          color: "#fb923c",
        });
      }
    }

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
    // Advance on Jump too — the shell reserves Start for its pause menu.
    if (
      context.players.some((player) => {
        const action = session.input.actionsFor(player);
        return action.justStart || action.justJump;
      })
    ) {
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
