/**
 * Electron main process. Loads the shell's Vite dev server in development, or
 * the built shell bundle once packaged. Also owns the desktop-only game
 * server lifecycle (see gameServer.ts) so games with `build.desktopServer`
 * (packages/sdk/src/types.ts) can run their locally-spawned backend.
 */
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { forceStopGameServer, registerGameServerIpc } from "./gameServer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Matches apps/shell/vite.config.ts `server.port`.
const SHELL_DEV_URL = "http://localhost:5173";

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on("close", () => {
    forceStopGameServer();
  });

  if (app.isPackaged) {
    void win.loadFile(path.join(__dirname, "../../shell/dist/index.html"));
  } else {
    void win.loadURL(SHELL_DEV_URL);
  }

  return win;
}

registerGameServerIpc();

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  forceStopGameServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  forceStopGameServer();
});
