export const BUILT_GAME_IDS = [
  "raskulls",
  "pong",
  "space-invaders",
  "stick-smash",
  "iron-yard",
] as const;

export type BuiltGameId = (typeof BUILT_GAME_IDS)[number];
