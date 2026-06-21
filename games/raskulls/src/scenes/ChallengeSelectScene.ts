import Phaser from "phaser";
import { session } from "../session.js";
import { challengeDefinitions, createChallengeRuntime } from "../systems/challenges.js";

export class ChallengeSelectScene extends Phaser.Scene {
  private selected = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private moveReadyAt = 0;

  constructor() {
    super("ChallengeSelectScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x111827);
    this.add.text(48, 42, "Challenges", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "42px",
      fontStyle: "800",
      color: "#f8fafc",
    });

    this.cards = challengeDefinitions().map((challenge, index) =>
      this.createCard(index, challenge.name),
    );
    this.renderSelection();
  }

  override update(time: number): void {
    const context = session.context;
    session.input.tick();
    if (!context) {
      session.input.commit();
      return;
    }

    const actions = context.players.map((player) => session.input.actionsFor(player));
    if (actions.some((action) => action.justBack)) {
      this.scene.start("ModeSelectScene");
    } else if (actions.some((action) => action.justStart || action.justJump)) {
      const challenge = challengeDefinitions()[this.selected] ?? challengeDefinitions()[0]!;
      session.grandPrix = null;
      session.challenge = createChallengeRuntime(challenge.id, context.players);
      this.scene.start("ChallengeScene");
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
      this.selected = Math.min(challengeDefinitions().length - 1, this.selected + 1);
      this.moveReadyAt = time + 180;
      this.renderSelection();
    }

    session.input.commit();
  }

  private createCard(index: number, label: string): Phaser.GameObjects.Container {
    const x = 132 + index * 230;
    const y = 220;
    const rect = this.add.rectangle(0, 0, 190, 210, 0x1f2937, 1);
    rect.setStrokeStyle(3, 0x374151, 1);
    const title = this.add.text(0, 0, label, {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "24px",
      fontStyle: "800",
      color: "#f8fafc",
      align: "center",
      wordWrap: { width: 160 },
    });
    title.setOrigin(0.5);
    const card = this.add.container(x, y, [rect, title]);
    card.setData("rect", rect);
    return card;
  }

  private renderSelection(): void {
    for (let index = 0; index < this.cards.length; index++) {
      const card = this.cards[index]!;
      const rect = card.getData("rect") as Phaser.GameObjects.Rectangle;
      const active = index === this.selected;
      rect.setStrokeStyle(active ? 5 : 3, active ? 0xa78bfa : 0x374151, 1);
      card.setScale(active ? 1.06 : 1);
    }
  }
}
