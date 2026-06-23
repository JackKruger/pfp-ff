import type { GameManifest } from "@pfp/sdk";

const manifest = {
  id: "stick-smash",
  name: "Stick Smash",
  version: "0.1.0",
  engine: "web",
  entry: "/games/stick-smash/index.html",
  thumbnail: "/thumbnails/stick-smash.png",
  players: { min: 1, max: 4 },
  sdk: "^1.0.0",
  tags: ["fighting", "party"],
  statKeys: {
    kills: { label: "Kills", scope: "player" },
    deaths: { label: "Deaths", scope: "player" },
    lives: { label: "Lives", scope: "player" },
  },
  input: {
    mode: "hybrid",
    actions: {
      moveX: [{ source: "leftStickX", deadzone: 0.18 }, { source: "dpadX" }],
      moveY: [
        { source: "leftStickY", deadzone: 0.18, scale: -1 },
        { source: "dpadY", scale: -1 },
      ],
      aimX: [{ source: "rightStickX", deadzone: 0.25 }],
      aimY: [{ source: "rightStickY", deadzone: 0.25, scale: -1 }],
      jump: [{ source: "a" }],
      attack: [{ source: "rt" }, { source: "rb" }],
      grab: [{ source: "x" }, { source: "lb" }, { source: "lt" }],
      throw: [{ source: "b" }],
      special: [{ source: "y" }],
    },
  },
  presentation: {
    category: "fighting",
    accent: "#ff3b6b",
    icon: "🥊",
    blurb: "Physics stick brawls with weapons, hazards, and last-player-standing chaos.",
  },
  build: {
    packageName: "@pfp/stick-smash",
    devPort: 5178,
    built: true,
  },
} satisfies GameManifest;

export default manifest;
