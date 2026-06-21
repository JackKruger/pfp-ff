import { createContext, useContext } from "react";
import { InputPoller, BrowserGamepadSource } from "@pfp/input";

/**
 * Centralises the single requestAnimationFrame loop for the shell.
 * Each tick: poller.tick() fires, then every registered handler is called.
 * Screens subscribe for their lifetime to avoid multiple rAF loops.
 */
export class ShellTicker {
  readonly poller = new InputPoller(new BrowserGamepadSource());
  private readonly handlers = new Set<() => void>();
  private rafId: number | null = null;

  start(): void {
    if (this.rafId !== null) return;
    const loop = (): void => {
      this.poller.tick();
      for (const h of this.handlers) h();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  onTick(handler: () => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export const TickerCtx = createContext<ShellTicker | null>(null);

export function useShellTicker(): ShellTicker {
  const ctx = useContext(TickerCtx);
  if (!ctx) throw new Error("useShellTicker must be inside TickerCtx.Provider");
  return ctx;
}
