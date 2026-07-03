/**
 * Owns the single locally-spawned game server process the shell needs for
 * desktop-only games (manifest `build.desktopServer`, see
 * packages/sdk/src/types.ts). The shell only ever runs one game at a time, so
 * only one child process is tracked at a time.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ipcMain, type IpcMainInvokeEvent } from "electron";

const execFileAsync = promisify(execFile);

// apps/desktop/src (dev) or apps/desktop/dist (packaged) -> repo root, so
// manifests can give `desktopServer.cwd` as a path relative to the repo
// (e.g. "../mydrunner" for a sibling repo) instead of guessing whatever cwd
// the Electron process happens to have been launched with.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export interface DesktopServerConfig {
  /** argv, e.g. ["node", "dist/server.js"]. command[0] is the executable. */
  command: string[];
  cwd: string;
  healthCheckUrl: string;
  port: number;
}

const HEALTH_CHECK_TIMEOUT_MS = 10_000;
const HEALTH_CHECK_INTERVAL_MS = 250;
// Bounds a single health-check request so a server that accepts the TCP
// connection but never responds can't stall pollHealthCheck's loop past its
// own deadline check (which only runs between requests, not during one).
const HEALTH_CHECK_REQUEST_TIMEOUT_MS = 2_000;
const STOP_GRACE_MS = 3_000;

let currentChild: ChildProcess | null = null;

// Serializes every start/stop call through a single FIFO queue. Without
// this, two overlapping `game-server:start` invocations (e.g. a renderer
// effect re-running before its previous call resolved) could interleave
// reads/writes of `currentChild` with no lock, each racing the other's
// spawn/kill. Every IPC handler below goes through this instead of running
// its body directly.
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Best-effort: kill whatever is already bound to `port`. Never throws. */
async function killWhateverIsOnPort(port: number): Promise<void> {
  try {
    if (process.platform === "win32") {
      // `netstat -ano -p tcp` columns: Proto  Local Address  Foreign Address
      // State  PID. Match only the Local Address column against the exact
      // port suffix and require a LISTENING state, rather than substring-
      // matching the whole line (which could hit an unrelated process whose
      // *foreign* address or PID happens to contain the port digits).
      const { stdout } = await execFileAsync("netstat", ["-ano", "-p", "tcp"]);
      const pids = new Set<string>();
      for (const line of stdout.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) continue;
        const [, localAddress, , state, pid] = parts;
        if (state !== "LISTENING") continue;
        if (!localAddress?.endsWith(`:${port}`)) continue;
        if (pid && pid !== "0") pids.add(pid);
      }
      for (const pid of pids) {
        await execFileAsync("taskkill", ["/PID", pid, "/F"]).catch(() => undefined);
      }
    } else {
      const { stdout } = await execFileAsync("lsof", ["-ti", `tcp:${port}`]);
      const pids = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      for (const pid of pids) {
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch {
          // Already gone; ignore.
        }
      }
    }
  } catch (error) {
    console.log(`[pfp-desktop] could not clear port ${port} (continuing):`, error);
  }
}

async function pollHealthCheck(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), HEALTH_CHECK_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) return;
      lastError = new Error(`health check responded ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(abortTimer);
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS));
  }
  throw new Error(
    `health check at ${url} did not become ready within ${timeoutMs}ms: ${String(lastError)}`,
  );
}

function killChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const forceKill = setTimeout(() => {
      child.kill("SIGKILL");
    }, STOP_GRACE_MS);
    child.once("exit", () => {
      clearTimeout(forceKill);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function startGameServer(
  _event: IpcMainInvokeEvent,
  config: DesktopServerConfig,
): Promise<{ url: string }> {
  if (currentChild) {
    await killChild(currentChild);
    currentChild = null;
  }

  await killWhateverIsOnPort(config.port);

  const [command, ...args] = config.command;
  if (!command) throw new Error("desktopServer.command must have at least one entry");

  const cwd = path.isAbsolute(config.cwd) ? config.cwd : path.resolve(REPO_ROOT, config.cwd);
  // desktopServer is for a single, same-machine couch session (see
  // docs/ARCHITECTURE.md's "no netcode" non-goal) — HOST restricts any
  // server respecting it to loopback so it's never reachable over the LAN.
  // Servers that don't read HOST are unaffected (this only narrows, never
  // widens, whatever they'd otherwise bind to).
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, HOST: "127.0.0.1" },
  });
  currentChild = child;

  try {
    await pollHealthCheck(config.healthCheckUrl, HEALTH_CHECK_TIMEOUT_MS);
  } catch (error) {
    await killChild(child);
    if (currentChild === child) currentChild = null;
    throw error;
  }

  const url = new URL(config.healthCheckUrl).origin;
  return { url };
}

async function stopGameServer(): Promise<void> {
  if (!currentChild) return;
  const child = currentChild;
  currentChild = null;
  await killChild(child);
}

/** Force-stop any running child. Safe to call even if nothing is running. */
export function forceStopGameServer(): void {
  if (!currentChild) return;
  const child = currentChild;
  currentChild = null;
  child.kill("SIGKILL");
}

export function registerGameServerIpc(): void {
  ipcMain.handle("game-server:start", (event, config: DesktopServerConfig) =>
    serialize(() => startGameServer(event, config)),
  );
  ipcMain.handle("game-server:stop", () => serialize(() => stopGameServer()));
}
