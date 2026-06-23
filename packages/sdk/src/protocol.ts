/**
 * The wire protocol: message names and the envelope that namespaces our messages
 * so foreign postMessage traffic (browser extensions, other libraries) is ignored.
 */
import type { ControlFrame, GameResult, LaunchContext } from "./types.js";

/** Every PFP message carries this channel tag; anything else is ignored. */
export const CHANNEL = "pfp" as const;

/** Game -> Shell message types. */
export const GameToShell = {
  READY: "ready",
  GAME_OVER: "gameOver",
  REQUEST_EXIT: "requestExit",
  ERROR: "error",
} as const;

/** Shell -> Game message types. */
export const ShellToGame = {
  LAUNCH: "launch",
  PAUSE: "pause",
  RESUME: "resume",
  TERMINATE: "terminate",
  INPUT_FRAME: "inputFrame",
} as const;

export type GameToShellType = (typeof GameToShell)[keyof typeof GameToShell];
export type ShellToGameType = (typeof ShellToGame)[keyof typeof ShellToGame];

/** Payload map so each message type is correctly typed end to end. */
export interface MessagePayloads {
  [GameToShell.READY]: { sdkVersion: string };
  [GameToShell.GAME_OVER]: GameResult;
  [GameToShell.REQUEST_EXIT]: undefined;
  [GameToShell.ERROR]: { message: string };
  [ShellToGame.LAUNCH]: LaunchContext;
  [ShellToGame.PAUSE]: undefined;
  [ShellToGame.RESUME]: undefined;
  [ShellToGame.TERMINATE]: undefined;
  [ShellToGame.INPUT_FRAME]: ControlFrame;
}

export interface EnvelopeFor<T extends keyof MessagePayloads> {
  channel: typeof CHANNEL;
  type: T;
  payload: MessagePayloads[T];
}

/**
 * Discriminated union over all message types, so `switch (envelope.type)`
 * narrows `envelope.payload` to the matching payload.
 */
export type Envelope = { [K in keyof MessagePayloads]: EnvelopeFor<K> }[keyof MessagePayloads];

export function makeEnvelope<T extends keyof MessagePayloads>(
  type: T,
  payload: MessagePayloads[T],
): EnvelopeFor<T> {
  return { channel: CHANNEL, type, payload };
}

export function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { channel?: unknown }).channel === CHANNEL &&
    typeof (value as { type?: unknown }).type === "string"
  );
}
