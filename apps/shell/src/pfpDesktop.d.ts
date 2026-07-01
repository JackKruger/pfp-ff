/**
 * Ambient bridge exposed by apps/desktop's preload script (see
 * apps/desktop/src/preload.ts) when the shell runs inside the Electron
 * desktop wrapper. Absent in plain-browser mode.
 */
import type { GameDesktopServerManifest } from "@pfp/sdk";

export {};

declare global {
  interface Window {
    pfpDesktop?: {
      startGameServer(config: GameDesktopServerManifest): Promise<{ url: string }>;
      stopGameServer(): Promise<void>;
    };
  }
}
