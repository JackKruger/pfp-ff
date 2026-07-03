/**
 * The data model of the game contract. See docs/ARCHITECTURE.md §5.
 *
 * These types are shared verbatim by the shell host and every game (native-TS or
 * Godot-export), so they are the single source of truth for the protocol's shape.
 */

/** Which engine a game is built with — purely informational to the host. */
export type GameEngine = "web" | "godot";

/** Optional label/grouping metadata for a freeform stat key (see §5.4). */
export interface StatKeyDef {
  label: string;
  /** Whether the stat is reported per-player or once for the whole match. */
  scope: "player" | "match";
}

/** A per-game achievement definition declared in the manifest (see §7.2). */
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Points this contributes to a profile's overall score when unlocked. */
  points: number;
  icon?: string;
  secret?: boolean;
}

/** How a game receives local player input from the shell/browser. */
export type GameInputMode = "direct" | "forwarded" | "hybrid";

/** Normalized input sources that can be mapped to named game actions. */
export type GameInputSource =
  | "leftStickX"
  | "leftStickY"
  | "rightStickX"
  | "rightStickY"
  | "dpadX"
  | "dpadY"
  | "a"
  | "b"
  | "x"
  | "y"
  | "lb"
  | "rb"
  | "lt"
  | "rt"
  | "start"
  | "back";

/** One mapping from a normalized input source to a game-specific action. */
export interface GameActionBinding {
  source: GameInputSource;
  scale?: number;
  deadzone?: number;
}

/** Optional input contract metadata for games that use shell-forwarded controls. */
export interface GameInputManifest {
  mode: GameInputMode;
  actions?: Record<string, GameActionBinding[]>;
  tickHz?: number;
}

export type ControlButton =
  | "a"
  | "b"
  | "x"
  | "y"
  | "lb"
  | "rb"
  | "lt"
  | "rt"
  | "start"
  | "back"
  | "up"
  | "down"
  | "left"
  | "right";

export interface ControlButtonState {
  pressed: boolean;
  justPressed: boolean;
  justReleased: boolean;
  value: number;
}

export interface ControlActionState extends ControlButtonState {
  x?: number;
  y?: number;
}

export interface ControlPlayerFrame {
  slot: number;
  profileId: string | null;
  connected: boolean;
  source: "gamepad" | "keyboard" | "ai" | "none";
  axes: {
    moveX: number;
    moveY: number;
    aimX: number;
    aimY: number;
    throttle?: number;
  };
  buttons: Record<ControlButton, ControlButtonState>;
  actions: Record<string, ControlActionState>;
}

export interface ControlFrame {
  seq: number;
  now: number;
  dtMs: number;
  paused: boolean;
  players: ControlPlayerFrame[];
}

/** Optional user-configurable launch settings exposed by the shell. */
export interface GameSettingsManifest {
  fields: GameSettingDef[];
}

export type GameSettingDef =
  | { id: string; label: string; type: "boolean"; default: boolean }
  | {
      id: string;
      label: string;
      type: "number";
      min: number;
      max: number;
      step?: number;
      default: number;
    }
  | {
      id: string;
      label: string;
      type: "choice";
      options: GameSettingOption[];
      default: string;
    };

export interface GameSettingOption {
  value: string;
  label: string;
}

/** Filterable library categories shown by shell presentations. */
export type GamePresentationCategory = "racing" | "classic" | "fighting" | "party";

/** Optional shell-facing display metadata for a game library entry. */
export interface GamePresentationManifest {
  category?: GamePresentationCategory;
  accent?: string;
  icon?: string;
  blurb?: string;
  heroArt?: string;
  featured?: boolean;
  disabled?: boolean;
}

/**
 * Optional desktop-only server process the shell must spawn before launching
 * the game and tear down on exit. Used by games whose client needs a locally
 * running backend (e.g. an authoritative multiplayer server). Only honored by
 * the Electron desktop shell (`apps/desktop`); browser-only shells cannot spawn
 * processes, so games declaring this must be treated as unlaunchable there.
 */
export interface GameDesktopServerManifest {
  /** argv, e.g. ["node", "dist/server.js"]. command[0] is the executable. */
  command: string[];
  /** Working directory the command is spawned from. */
  cwd: string;
  /** URL polled until it responds ok before the game is launched. */
  healthCheckUrl: string;
  /** Port the server listens on; used to best-effort clear stale listeners. */
  port: number;
}

/** Optional build/dev metadata used by shell catalog tooling. */
export interface GameBuildManifest {
  packageName?: string;
  devPort?: number;
  built?: boolean;
  /** Desktop-only local server process this game needs the shell to manage. */
  desktopServer?: GameDesktopServerManifest;
}

/** Optional session-shape metadata about how a match ends. */
export interface GameSessionManifest {
  /**
   * True for games with no win condition or match ranking (e.g. an open
   * sandbox/exploration mode). The shell skips results/recording on
   * `requestExit` for these and just returns to the library.
   */
  endless?: boolean;
}

/** `game.json` — what a game ships so the shell can list and launch it (§5.1). */
export interface GameManifest {
  /** Unique, stable, kebab-case id. */
  id: string;
  name: string;
  version: string;
  engine: GameEngine;
  /** Entry document loaded into the iframe, relative to the game root. */
  entry: string;
  players: { min: number; max: number };
  thumbnail?: string;
  tags?: string[];
  /** Semver range of the contract this game targets, e.g. "^1.0.0". */
  sdk: string;
  /** Optional labels for the freeform stat keys this game emits. Metadata only. */
  statKeys?: Record<string, StatKeyDef>;
  /** Optional per-game achievements. */
  achievements?: AchievementDef[];
  /** Optional input contract metadata. Existing games default to direct input. */
  input?: GameInputManifest;
  /** Optional launch settings schema. */
  settings?: GameSettingsManifest;
  /** Optional shell-facing presentation metadata. */
  presentation?: GamePresentationManifest;
  /** Optional build/dev metadata for catalog tooling. */
  build?: GameBuildManifest;
  /** Optional session-shape metadata (e.g. endless games with no ranking). */
  session?: GameSessionManifest;
}

/** One player position in a match, bound to a controller and (maybe) a profile. */
export interface PlayerSlot {
  /** 0..3 — P1..P4. */
  slot: number;
  /** null = guest (not a saved profile). */
  profileId: string | null;
  displayName: string;
  /** The player's identity color (hex). */
  color: string;
  /** Index into navigator.getGamepads() for this slot's controller. */
  gamepadIndex: number;
}

/** Sent shell -> game on launch: who's playing and on which controllers (§5.2). */
export interface LaunchContext {
  /** Unique per match. */
  sessionId: string;
  sdkVersion: string;
  players: PlayerSlot[];
  /** Optional per-game options chosen in the shell. */
  settings: Record<string, unknown>;
}

/** Where one player placed in a match, plus optional freeform stats (§5.4). */
export interface PlayerStanding {
  slot: number;
  profileId: string | null;
  /** 1 = winner; ties share a rank. */
  rank: number;
  /** Optional numeric score. */
  score?: number;
  /** Game-defined per-player stats, e.g. { kos: 7, falls: 2 }. */
  stats?: Record<string, number>;
}

/** The result a game reports on finish (§5.4). Every game reduces to this. */
export interface GameResult {
  gameId: string;
  sessionId: string;
  /** epoch ms */
  startedAt: number;
  /** epoch ms */
  endedAt: number;
  standings: PlayerStanding[];
  /** Freeform, game-defined match-level data. */
  gameStats?: Record<string, unknown>;
  /** Ids of achievements the game itself determined were unlocked (§7.2). */
  achievements?: string[];
}
