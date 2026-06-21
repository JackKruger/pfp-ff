// Playwright screenshot script for PFP-FF
// Launches each game via postMessage and captures screenshots
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "docs", "screenshots");
mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 1280, height: 720 };

/** Injects a launch payload into the game so it starts */
async function injectLaunch(page, players = 2) {
  const launchPayload = {
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
  await page.evaluate((msg) => {
    window.postMessage(msg, "*");
  }, launchPayload);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  const size = (await import("fs")).statSync(path).size;
  console.log(`  📸 ${name}.png (${(size / 1024).toFixed(1)} KB)`);
}

async function launchAndShot(page, url, name, opts = {}) {
  const { players = 2, waitMs = 2000, extraWaits = [] } = opts;
  console.log(`  Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1000);
  await injectLaunch(page, players);
  await page.waitForTimeout(waitMs);
  await shot(page, name);
  for (const [n, ms] of extraWaits) {
    await page.waitForTimeout(ms);
    await shot(page, n);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });

  // ── Shell Menu ──
  console.log("\n=== Shell Menu ===");
  const shell = await ctx.newPage();
  await shell.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await shell.waitForTimeout(3000);
  await shot(shell, "shell-menu");
  await shell.close();

  // ── Pong ──
  console.log("\n=== Pong ===");
  const pong = await ctx.newPage();
  await pong.goto("http://localhost:5175/games/pong/", { waitUntil: "networkidle" });
  await pong.waitForTimeout(1000);
  await injectLaunch(pong, 2);
  await pong.waitForTimeout(2000);
  await shot(pong, "pong-attract");
  await pong.waitForTimeout(4000);
  await shot(pong, "pong-rally");
  await pong.waitForTimeout(3000);
  await shot(pong, "pong-score");
  await pong.close();

  // ── Space Invaders ──
  console.log("\n=== Space Invaders ===");
  const si = await ctx.newPage();
  await si.goto("http://localhost:5176/games/space-invaders/", { waitUntil: "networkidle" });
  await si.waitForTimeout(1000);
  await injectLaunch(si, 1);
  await si.waitForTimeout(2000);
  await shot(si, "space-invaders-menu");
  // Press space to start
  await si.keyboard.press(" ");
  await si.waitForTimeout(3000);
  await shot(si, "space-invaders-gameplay");
  await si.waitForTimeout(4000);
  await shot(si, "space-invaders-action");
  await si.close();

  // ── Iron Yard ──
  console.log("\n=== Iron Yard ===");
  const iy = await ctx.newPage();
  await iy.goto("http://localhost:5177/games/iron-yard/", { waitUntil: "networkidle" });
  await iy.waitForTimeout(1000);
  await injectLaunch(iy, 1); // 1 human + 1 bot
  await iy.waitForTimeout(6000); // Rapier WASM + countdown + gameplay
  await shot(iy, "iron-yard-arena");
  await iy.waitForTimeout(5000);
  await shot(iy, "iron-yard-gameplay");
  await iy.waitForTimeout(5000);
  await shot(iy, "iron-yard-action");
  await iy.waitForTimeout(10000);
  await shot(iy, "iron-yard-intermission");
  await iy.close();

  // ── Raskulls ──
  console.log("\n=== Raskulls ===");
  const rk = await ctx.newPage();
  await rk.goto("http://localhost:5174/games/raskulls/", { waitUntil: "networkidle" });
  await rk.waitForTimeout(1000);
  await injectLaunch(rk, 2);
  await rk.waitForTimeout(3000);
  await shot(rk, "raskulls-menu");
  await rk.keyboard.press(" ");
  await rk.waitForTimeout(4000);
  await shot(rk, "raskulls-gameplay");
  await rk.waitForTimeout(5000);
  await shot(rk, "raskulls-action");
  await rk.close();

  console.log("\n=== All screenshots taken ===");
  await browser.close();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
