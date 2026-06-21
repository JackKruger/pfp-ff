import Phaser from "phaser";
import "./style.css";
import { session } from "./session.js";
import { BootScene } from "./scenes/BootScene.js";
import { ModeSelectScene } from "./scenes/ModeSelectScene.js";
import { ChallengeSelectScene } from "./scenes/ChallengeSelectScene.js";
import { ChallengeScene } from "./scenes/ChallengeScene.js";
import { RaceScene } from "./scenes/RaceScene.js";
import { ArenaScene } from "./scenes/ArenaScene.js";
import { ResultsScene } from "./scenes/ResultsScene.js";

const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "game",
  backgroundColor: "#111827",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540,
  },
  scene: [
    BootScene,
    ModeSelectScene,
    ChallengeSelectScene,
    RaceScene,
    ChallengeScene,
    ArenaScene,
    ResultsScene,
  ],
});

session.client.onTerminate(() => game.destroy(true));

window.addEventListener("error", (event) => {
  session.client.reportError(event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  session.client.reportError(String(event.reason));
});
