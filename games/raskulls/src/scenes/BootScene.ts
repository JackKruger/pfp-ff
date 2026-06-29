import Phaser from "phaser";
import {
  ART_MANIFEST_KEY,
  ART_MANIFEST_URL,
  createCodeTextures,
  queueExternalTextureAssets,
} from "../assets.js";
import { session } from "../session.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.load.json(ART_MANIFEST_KEY, ART_MANIFEST_URL);
  }

  create(): void {
    if (queueExternalTextureAssets(this)) {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => this.finishBoot());
      this.load.start();
      return;
    }

    this.finishBoot();
  }

  private finishBoot(): void {
    createCodeTextures(this);
    session.client.ready();
    this.scene.start("ModeSelectScene");
  }
}
