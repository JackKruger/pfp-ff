/**
 * Exposes a minimal bridge for the shell (running in the renderer) to start
 * and stop a desktop-only game server. See apps/shell/src/pfpDesktop.d.ts for
 * the ambient type the shell code imports against.
 */
import { contextBridge, ipcRenderer } from "electron";
import type { DesktopServerConfig } from "./gameServer.js";

contextBridge.exposeInMainWorld("pfpDesktop", {
  startGameServer: (config: DesktopServerConfig): Promise<{ url: string }> =>
    ipcRenderer.invoke("game-server:start", config),
  stopGameServer: (): Promise<void> => ipcRenderer.invoke("game-server:stop"),
});
