/**
 * Validation for the desktop-server config the renderer sends over IPC
 * (`game-server:start`). The main process must not trust the renderer: a
 * same-origin game iframe can reach `window.parent.pfpDesktop`, so anything
 * spawnable/killable from this IPC surface is reachable from game code.
 *
 * This bounds the blast radius — loopback-only health checks, an unprivileged
 * port (which `killWhateverIsOnPort` will clear!), and a structurally sane
 * argv. Games remain first-party trusted code for now; a manifest-keyed
 * allowlist owned by the main process is the eventual stricter fix.
 *
 * Kept free of Electron imports so it can be unit-tested directly.
 */
import type { DesktopServerConfig } from "./gameServer.js";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Lowest port the shell may manage; killWhateverIsOnPort must never be able
 *  to target well-known-service ports (sshd, databases, ...). */
const MIN_PORT = 1024;

/** Returns a list of problems; empty means the config may be acted on. */
export function validateDesktopServerConfig(config: unknown): string[] {
  const errors: string[] = [];
  if (typeof config !== "object" || config === null) {
    return ["config must be an object"];
  }
  const c = config as Partial<DesktopServerConfig>;

  if (
    !Array.isArray(c.command) ||
    c.command.length === 0 ||
    c.command.some((part) => typeof part !== "string" || part === "")
  ) {
    errors.push("command must be a non-empty array of non-empty strings");
  }

  if (typeof c.cwd !== "string" || c.cwd === "") {
    errors.push("cwd must be a non-empty string");
  }

  if (!Number.isInteger(c.port) || (c.port as number) < MIN_PORT || (c.port as number) > 65535) {
    errors.push(`port must be an integer in [${MIN_PORT}, 65535]`);
  }

  if (typeof c.healthCheckUrl !== "string") {
    errors.push("healthCheckUrl must be a string");
  } else {
    let url: URL | null = null;
    try {
      url = new URL(c.healthCheckUrl);
    } catch {
      errors.push("healthCheckUrl must be a valid URL");
    }
    if (url) {
      if (url.protocol !== "http:") {
        errors.push("healthCheckUrl must use http:");
      }
      if (!LOOPBACK_HOSTS.has(url.hostname)) {
        errors.push("healthCheckUrl must point at loopback (localhost / 127.0.0.1 / [::1])");
      }
      const urlPort = url.port === "" ? 80 : Number(url.port);
      if (Number.isInteger(c.port) && urlPort !== c.port) {
        errors.push("healthCheckUrl port must match config.port");
      }
    }
  }

  return errors;
}
