/**
 * Owns the single locally-spawned game server process the shell needs for
 * desktop-only games (manifest `build.desktopServer`, see
 * packages/sdk/src/types.ts). The shell only ever runs one game at a time, so
 * only one child process is tracked at a time.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ipcMain, type IpcMainInvokeEvent } from "electron";

const execFileAsync = promisify(execFile);

export interface DesktopServerConfig {
  /** argv, e.g. ["node", "dist/server.js"]. command[0] is the executable. */
  command: string[];
  cwd: string;
  healthCheckUrl: string;
  port: number;
}

const HEALTH_CHECK_TIMEOUT_MS = 10_000;
const HEALTH_CHECK_INTERVAL_MS = 250;
const STOP_GRACE_MS = 3_000;

let currentChild: ChildProcess | null = null;

/** Best-effort: kill whatever is already bound to `port`. Never throws. */
async function killWhateverIsOnPort(port: number): Promise<void> {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("netstat", ["-ano", "-p", "tcp"]);
      const pids = new Set<string>();
      for (const line of stdout.split("\n")) {
        if (line.includes(`:${port} `) || line.includes(`:${port}\r`)) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== "0") pids.add(pid);
        }
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
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`health check responded ${response.status}`);
    } catch (error) {
      lastError = error;
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

  const child = spawn(command, args, { cwd: config.cwd, stdio: "inherit" });
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
  ipcMain.handle("game-server:start", startGameServer);
  ipcMain.handle("game-server:stop", stopGameServer);
}
