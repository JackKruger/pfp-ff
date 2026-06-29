#!/usr/bin/env node
// Captures screenshots of every shell screen and game.
// Run with: pnpm screenshot
// Requires dev servers to already be running: pnpm dev (separate terminal)
//
// Output: docs/screenshots/<name>.png
// Shell screens: home, pairing, profiles, stats
// Games:        raskulls (3), pong (3), space-invaders (3), iron-yard (3), stick-smash (3)

import { chromium } from "playwright";
import { mkdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "docs", "screenshots");
mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 1280, height: 720 };

const SERVERS = {
  shell: { url: "http://localhost:5173", path: "/" },
  raskulls: { url: "http://localhost:5174", path: "/games/raskulls/" },
  pong: { url: "http://localhost:5175", path: "/games/pong/" },
  "space-invaders": { url: "http://localhost:5176", path: "/games/space-invaders/" },
  "iron-yard": { url: "http://localhost:5177", path: "/games/iron-yard/" },
  "stick-smash": { url: "http://localhost:5178", path: "/games/stick-smash/" },
};

async function isUp(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 ${name}.png  (${(statSync(path).size / 1024).toFixed(1)} KB)`);
}

function makeLaunchMsg(players = 2) {
  return {
    channel: "pfp",
    type: "launch",
    payload: {
      sessionId: "screenshot-session",
      sdkVersion: "1.0.0",
      players: Array.from({ length: players }, (_, i) => ({
        slot: i,
        profileId: null,
        displayName: `P${i + 1}`,
        color: ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"][i],
        gamepadIndex: -1,
      })),
      settings: {},
    },
  };
}

async function launch(page, players = 2) {
  await page.evaluate((msg) => window.postMessage(msg, "*"), makeLaunchMsg(players));
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // ── Server health check ────────────────────────────────────────────────────
  console.log("Checking servers...");
  const up = {};
  for (const [name, { url }] of Object.entries(SERVERS)) {
    up[name] = await isUp(url);
    console.log(`  ${up[name] ? "✅" : "❌"} ${name}  (${url})`);
  }
  const anyUp = Object.values(up).some(Boolean);
  if (!anyUp) {
    console.error("\nNo servers are running. Start them with: pnpm dev");
    process.exit(1);
  }

  const executablePath =
    process.env.PLAYWRIGHT_BROWSERS_PATH
      ? join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium")
      : "/opt/pw-browsers/chromium";

  const browser = await chromium.launch({ headless: true, executablePath });
  const ctx = await browser.newContext({ viewport: VIEWPORT });

  // ── Shell ──────────────────────────────────────────────────────────────────
  if (up.shell) {
    console.log("\n=== Shell ===");
    const base = SERVERS.shell.url;

    // Navigate Zustand store directly via Vite's module graph — reliable across
    // all screens without depending on keyboard/focus state.
    async function shellScreen(screen, setup) {
      const page = await ctx.newPage();
      await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 15000 });
      await wait(1500);
      if (setup) await setup(page);
      if (screen !== "home") {
        await page.evaluate(async (s) => {
          const { useShell } = await import("/src/store.ts");
          useShell.getState().navigate(s);
        }, screen);
        await wait(800);
      }
      return page;
    }

    // Home
    const home = await shellScreen("home");
    await shot(home, "shell-home");
    await home.close();

    // Pairing — needs a game selected first; hero-play is autoFocused so Enter works
    const pairing = await shellScreen("home", async (p) => {
      await p.keyboard.press("Enter");
      await wait(600);
    });
    await shot(pairing, "shell-pairing");
    await pairing.close();

    // Profiles
    const profiles = await shellScreen("profiles");
    await shot(profiles, "shell-profiles");
    await profiles.close();

    // Stats
    const stats = await shellScreen("stats");
    await shot(stats, "shell-stats");
    await stats.close();
  }

  // ── Raskulls ───────────────────────────────────────────────────────────────
  if (up.raskulls) {
    console.log("\n=== Raskulls ===");
    const page = await ctx.newPage();
    const { url, path } = SERVERS.raskulls;

    await page.goto(`${url}${path}`, { waitUntil: "networkidle", timeout: 15000 });
    await wait(2000);
    await shot(page, "raskulls-mode-select");   // Mode select (before launch)

    // Inject launch so session.context is set — mode select won't process
    // input until context exists. Then press Space (=jump) to start Race mode.
    await launch(page, 2);
    await wait(400);                            // one render cycle for context to land
    await page.keyboard.press("Space");
    await wait(3500);
    await shot(page, "raskulls-race-start");    // Level loaded, pre-race overlay

    await wait(7000);
    await shot(page, "raskulls-race-mid");      // Mid-race gameplay

    await page.close();
  }

  // ── Pong ───────────────────────────────────────────────────────────────────
  if (up.pong) {
    console.log("\n=== Pong ===");
    const page = await ctx.newPage();
    const { url, path } = SERVERS.pong;

    await page.goto(`${url}${path}`, { waitUntil: "networkidle", timeout: 15000 });
    await wait(1000);
    await shot(page, "pong-attract");           // Waiting for launch

    await launch(page, 2);
    await wait(2500);
    await shot(page, "pong-serve");             // Serve countdown

    await wait(4000);
    await shot(page, "pong-rally");             // Ball in play

    await page.close();
  }

  // ── Space Invaders ─────────────────────────────────────────────────────────
  if (up["space-invaders"]) {
    console.log("\n=== Space Invaders ===");
    const page = await ctx.newPage();
    const { url, path } = SERVERS["space-invaders"];

    await page.goto(`${url}${path}`, { waitUntil: "networkidle", timeout: 15000 });
    await wait(1000);
    await shot(page, "space-invaders-attract"); // Waiting for launch

    await launch(page, 1);
    await wait(1500);
    await shot(page, "space-invaders-title");   // "Press Fire to start"

    await page.keyboard.press(" ");
    await wait(3000);
    await shot(page, "space-invaders-gameplay"); // Wave in progress

    await wait(4000);
    await shot(page, "space-invaders-action");  // Mid-wave

    await page.close();
  }

  // ── Iron Yard ──────────────────────────────────────────────────────────────
  if (up["iron-yard"]) {
    console.log("\n=== Iron Yard ===");
    const page = await ctx.newPage();
    const { url, path } = SERVERS["iron-yard"];

    await page.goto(`${url}${path}`, { waitUntil: "networkidle", timeout: 15000 });
    await wait(1000);

    await launch(page, 2);
    await wait(7000);                           // Rapier WASM + countdown
    await shot(page, "iron-yard-arena");        // Arena with players loaded

    await wait(5000);
    await shot(page, "iron-yard-combat");       // Combat in progress

    await wait(8000);
    await shot(page, "iron-yard-action");       // More action / mid-bout

    await page.close();
  }

  // ── Stick Smash ────────────────────────────────────────────────────────────
  if (up["stick-smash"]) {
    console.log("\n=== Stick Smash ===");
    const page = await ctx.newPage();
    const { url, path } = SERVERS["stick-smash"];

    await page.goto(`${url}${path}`, { waitUntil: "networkidle", timeout: 15000 });
    await wait(1500);
    await shot(page, "stick-smash-attract");    // Attract screen

    // Rapier WASM + upstream Game init can take 5-8s. Wait for it before
    // injecting launch so onLaunch is registered before the message arrives.
    await wait(7000);
    await launch(page, 2);
    await wait(5000);
    await shot(page, "stick-smash-start");      // Match loaded

    await wait(6000);
    await shot(page, "stick-smash-gameplay");   // Gameplay in progress

    await page.close();
  }

  console.log(`\n✅ Screenshots saved to docs/screenshots/`);
  await browser.close();
}

main().catch((e) => {
  console.error("\nError:", e);
  process.exit(1);
});
