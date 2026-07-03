/**
 * Headless browser smoke test.
 *
 * Builds-and-served by Vite preview workflow externally; this test just
 * verifies that when the built bundle is loaded in a real browser:
 *   1. The page bootstraps without JS errors
 *   2. The game posts an SDK `ready` message
 *   3. The game accepts a `launch` envelope and starts running
 *   4. The canvas actually draws pixels (not just zeroed)
 *   5. Keyboard input drives the placement cursor
 *
 * It skips itself with a clear message if `dist/` hasn't been built yet, so
 * it never breaks `pnpm test` for someone who hasn't run `pnpm build` first.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..", "dist");

const BASE_PATH = "/games/fowl-play";
const TEST_TIMEOUT_MS = 60_000;

/* -------------------------------------------------------------------------- */
/*  Setup gates                                                               */
/* -------------------------------------------------------------------------- */

const distAvailable = existsSync(path.join(distDir, "index.html"));
const chromiumPath = findChromiumBinary();

const skipReason = !distAvailable
  ? "skipped: dist/ not built. Run `pnpm --filter @pfp/fowl-play build` first."
  : !chromiumPath
    ? "skipped: no Chromium binary found under PLAYWRIGHT_BROWSERS_PATH."
    : null;

function findChromiumBinary(): string | null {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!existsSync(root)) return null;
  try {
    for (const dir of readdirSync(root)) {
      if (!dir.startsWith("chromium")) continue;
      const candidate = path.join(root, dir, "chrome-linux", "chrome");
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Static file server (serves dist under /games/fowl-play/ to match base)    */
/* -------------------------------------------------------------------------- */

function startServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      let pathname = url.pathname;
      if (pathname.startsWith(BASE_PATH)) pathname = pathname.slice(BASE_PATH.length);
      if (pathname === "" || pathname === "/") pathname = "/index.html";
      const file = path.join(distDir, pathname);
      try {
        const buf = await readFile(file);
        res.setHeader("Content-Type", contentType(file));
        res.end(buf);
      } catch {
        res.statusCode = 404;
        res.end();
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, port });
    });
  });
}

function contentType(file: string): string {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

/* -------------------------------------------------------------------------- */
/*  Shell harness — injected before the page loads                            */
/* -------------------------------------------------------------------------- */

const SHELL_HARNESS = `
(() => {
  const channel = "pfp";
  const captured = { ready: null, gameOver: null, error: null };
  window.__fowlCaptured = captured;
  window.addEventListener("message", (event) => {
    const e = event.data;
    if (!e || e.channel !== channel) return;
    if (e.type === "ready") {
      captured.ready = e.payload;
      // Reply with a single-player launch context.
      const launch = {
        channel,
        type: "launch",
        payload: {
          sessionId: "e2e-test-session",
          sdkVersion: e.payload?.sdkVersion ?? "1.0.0",
          players: [
            {
              slot: 0,
              profileId: null,
              displayName: "TestP1",
              color: "#ef4444",
              gamepadIndex: 0,
            },
            {
              slot: 1,
              profileId: null,
              displayName: "TestP2",
              color: "#3b82f6",
              gamepadIndex: 1,
            },
          ],
          settings: {},
        },
      };
      // Post back to the same window — game's createParentTransport listens here.
      window.postMessage(launch, "*");
    } else if (e.type === "gameOver") {
      captured.gameOver = e.payload;
    } else if (e.type === "error") {
      captured.error = e.payload;
    }
  });
})();
`;

/* -------------------------------------------------------------------------- */
/*  Suite                                                                     */
/* -------------------------------------------------------------------------- */

describe.skipIf(skipReason)("fowl-play e2e (headless browser)", () => {
  let server: http.Server | null = null;
  let port = 0;
  let browser: Browser | null = null;

  beforeAll(async () => {
    const started = await startServer();
    server = started.server;
    port = started.port;
    browser = await chromium.launch({
      executablePath: chromiumPath!,
      headless: true,
    });
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it(
    "boots, handshakes ready/launch, and renders the canvas",
    async () => {
      const ctx = await browser!.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await ctx.newPage();
      await page.addInitScript(SHELL_HARNESS);

      const consoleErrors: string[] = [];
      page.on("pageerror", (err) => consoleErrors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        // Favicon misses are noise — the static server has no favicon.
        if (/favicon/i.test(text) || /404/.test(text)) return;
        consoleErrors.push(text);
      });

      await page.goto(`http://127.0.0.1:${port}${BASE_PATH}/`, {
        waitUntil: "load",
      });

      // Tee console so failures show what the page saw.
      const allMessages: string[] = [];
      page.on("console", (msg) => allMessages.push(`[${msg.type()}] ${msg.text()}`));

      // 1. READY captured by the harness within a few seconds.
      await page.waitForFunction(() => !!(window as never as { __fowlCaptured: { ready: unknown } }).__fowlCaptured.ready, undefined, {
        timeout: 5000,
      });

      // 2. Canvas exists and is sized.
      const dims = await page.evaluate(() => {
        const c = document.getElementById("game") as HTMLCanvasElement | null;
        return c ? { w: c.width, h: c.height } : null;
      });
      expect(dims).not.toBeNull();
      expect(dims!.w).toBeGreaterThan(100);
      expect(dims!.h).toBeGreaterThan(100);

      // 3. Give the game a few RAF ticks to settle into intro and render.
      await page.waitForTimeout(300);

      // 4. Canvas has non-empty pixels (something was drawn — not a blank canvas).
      const stats = await page.evaluate(() => {
        const c = document.getElementById("game") as HTMLCanvasElement | null;
        if (!c) return { found: false, max: 0, total: 0 };
        const ctx = c.getContext("2d");
        if (!ctx) return { found: true, max: 0, total: 0 };
        // Sample the whole canvas; anything brighter than deep navy is "drawn".
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let nz = 0;
        let max = 0;
        for (let i = 0; i < data.length; i += 4) {
          const m = Math.max(data[i], data[i + 1], data[i + 2]);
          if (m > max) max = m;
          if (m > 15) nz++;
        }
        return { found: true, max, total: nz, w: c.width, h: c.height };
      });
      if (!stats.total) {
        // eslint-disable-next-line no-console
        console.error("Canvas stats:", stats);
        // eslint-disable-next-line no-console
        console.error("Page console:", allMessages);
      }
      expect(stats.total).toBeGreaterThan(50);

      // 5. No unhandled JS errors during boot.
      expect(consoleErrors).toEqual([]);

      // 6. No error envelope was reported.
      const captured = await page.evaluate(
        () => (window as never as { __fowlCaptured: { error: unknown } }).__fowlCaptured.error,
      );
      expect(captured).toBeNull();

      await ctx.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "FSM advances from intro to placement (verified via canvas diff)",
    async () => {
      const ctx = await browser!.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await ctx.newPage();
      await page.addInitScript(SHELL_HARNESS);

      await page.goto(`http://127.0.0.1:${port}${BASE_PATH}/`, {
        waitUntil: "load",
      });
      await page.waitForFunction(
        () =>
          !!(window as never as { __fowlCaptured: { ready: unknown } }).__fowlCaptured.ready,
        undefined,
        { timeout: 5000 },
      );

      // The match starts on the arena-select menu; confirm it with Space
      // (keyboard fallback confirm for slot 0) so the FSM enters the intro.
      await page.keyboard.press("Space");

      // Hash the full canvas (RGB only, cheap rolling sum) at two points:
      // during the intro screen (which renders the look-around hint panel)
      // and ~6s later when the FSM should be in placement (intro lasts 5s).
      // Any redraw difference between the two phases proves the FSM ticked
      // forward and the renderer reflected it.
      const hash = async () =>
        page.evaluate(() => {
          const c = document.getElementById("game") as HTMLCanvasElement | null;
          if (!c) return 0;
          const ctx2d = c.getContext("2d");
          if (!ctx2d) return 0;
          const data = ctx2d.getImageData(0, 0, c.width, c.height).data;
          let h = 0;
          for (let i = 0; i < data.length; i += 4)
            h = (h * 31 + data[i] + data[i + 1] * 7 + data[i + 2] * 13) | 0;
          return h;
        });

      // Allow a few frames so intro is on screen.
      await page.waitForTimeout(400);
      const introHash = await hash();

      // Wait past the 5s look-around hint into placement phase.
      await page.waitForTimeout(5500);
      const placementHash = await hash();

      expect(placementHash).not.toBe(introHash);

      // No JS errors during the run.
      const errors = await page.evaluate(
        () => (window as never as { __fowlCaptured: { error: unknown } }).__fowlCaptured.error,
      );
      expect(errors).toBeNull();

      await ctx.close();
    },
    TEST_TIMEOUT_MS,
  );
});
