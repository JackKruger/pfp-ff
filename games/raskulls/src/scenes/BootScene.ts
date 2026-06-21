import Phaser from "phaser";
import { createCodeTextures } from "../assets.js";
import { session } from "../session.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    createCodeTextures(this);
    session.client.ready();
    this.scene.start("ModeSelectScene");
  }
}
