import Phaser from "phaser";
import { session } from "../session.js";
import { raceLevelDefinitions } from "../systems/levels.js";
import { createGrandPrixState } from "../systems/playlist.js";
import type { RaskullsMode } from "../systems/types.js";

type ModeSelectId = RaskullsMode | "grand-prix" | "challenge";

const MODES: Array<{ id: ModeSelectId; label: string; detail: string }> = [
  { id: "race", label: "Race", detail: "Dig to the finish" },
  { id: "grand-prix", label: "Grand Prix", detail: "Three-race playlist" },
  { id: "challenge", label: "Challenges", detail: "Objective variants" },
  { id: "arena", label: "Arena", detail: "Break, bump, survive" },
];

export class ModeSelectScene extends Phaser.Scene {
  private selected = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private statusText?: Phaser.GameObjects.Text;
  private moveReadyAt = 0;

  constructor() {
    super("ModeSelectScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x111827);
    this.add.text(48, 42, "Raskulls", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "46px",
      fontStyle: "800",
      color: "#f8fafc",
    });
    this.add.text(52, 96, "Choose Mode", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "20px",
      color: "#9ca3af",
    });

    this.cards = MODES.map((mode, index) => this.createCard(index, mode.label, mode.detail));
    this.statusText = this.add.text(52, this.scale.height - 52, "Waiting for players", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "18px",
      color: "#9ca3af",
    });
    this.renderSelection();
  }

  override update(time: number): void {
    const context = session.context;
    session.input.tick();

    if (!context) {
      session.input.commit();
      return;
    }

    this.statusText?.setText(`${context.players.length} players ready`);
    const actions = context.players.map((player) => session.input.actionsFor(player));
    if (actions.some((action) => action.justStart || action.justJump)) {
      const mode = MODES[this.selected]?.id ?? "race";
      if (mode === "grand-prix") {
        session.grandPrix = createGrandPrixState(
          raceLevelDefinitions().map((level) => level.id),
          context.players,
        );
        session.challenge = null;
        this.scene.start("RaceScene");
      } else if (mode === "challenge") {
        session.grandPrix = null;
        session.challenge = null;
        this.scene.start("ChallengeSelectScene");
      } else {
        session.grandPrix = null;
        session.challenge = null;
        this.scene.start(mode === "race" ? "RaceScene" : "ArenaScene");
      }
    } else if (actions.some((action) => action.justBack)) {
      session.client.requestExit();
    } else if (
      time >= this.moveReadyAt &&
      actions.some((action) => action.justDig || action.moveX < -0.45)
    ) {
      this.selected = Math.max(0, this.selected - 1);
      this.moveReadyAt = time + 180;
      this.renderSelection();
    } else if (
      time >= this.moveReadyAt &&
      actions.some((action) => action.justPower || action.moveX > 0.45)
    ) {
      this.selected = Math.min(MODES.length - 1, this.selected + 1);
      this.moveReadyAt = time + 180;
      this.renderSelection();
    }

    session.input.commit();
  }

  private createCard(index: number, label: string, detail: string): Phaser.GameObjects.Container {
    const x = 120 + index * 220;
    const y = 190;
    const rect = this.add.rectangle(0, 0, 190, 250, 0x1f2937, 1);
    rect.setStrokeStyle(3, 0x374151, 1);
    const glyph = this.add.text(
      0,
      -38,
      index === 0 ? ">>" : index === 1 ? "GP" : index === 2 ? "??" : "!!",
      {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: index === 1 ? "48px" : "58px",
        fontStyle: "800",
        color:
          index === 0 ? "#facc15" : index === 1 ? "#a78bfa" : index === 2 ? "#f472b6" : "#38bdf8",
      },
    );
    glyph.setOrigin(0.5);
    const title = this.add.text(0, 45, label, {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "34px",
      fontStyle: "800",
      color: "#f8fafc",
    });
    title.setOrigin(0.5);
    const sub = this.add.text(0, 86, detail, {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "16px",
      color: "#cbd5e1",
    });
    sub.setOrigin(0.5);
    const card = this.add.container(x, y, [rect, glyph, title, sub]);
    card.setData("rect", rect);
    return card;
  }

  private renderSelection(): void {
    for (let index = 0; index < this.cards.length; index++) {
      const card = this.cards[index]!;
      const rect = card.getData("rect") as Phaser.GameObjects.Rectangle;
      const active = index === this.selected;
      rect.setStrokeStyle(active ? 5 : 3, active ? 0xfacc15 : 0x374151, 1);
      card.setScale(active ? 1.06 : 1);
    }
  }
}
