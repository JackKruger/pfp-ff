// mydrunner's client lives in a separate repo/workspace (different Node
// engine requirement — Node>=22 for Rapier — so it isn't merged into this
// pnpm workspace). This script builds it there and copies the static output
// here, the same "build elsewhere, drop the bundle in" pattern already used
// for Godot HTML5 exports.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(scriptsDir, "..");
const mydrunnerRepo = path.resolve(
  gameDir,
  process.env.MYDRUNNER_REPO_PATH ?? "../../../mydrunner",
);
const clientDir = path.join(mydrunnerRepo, "packages", "client");
const clientDist = path.join(clientDir, "dist");
const outDir = path.join(gameDir, "dist");

if (!existsSync(mydrunnerRepo)) {
  console.error(
    `mydrunner repo not found at ${mydrunnerRepo}. Set MYDRUNNER_REPO_PATH to its checkout path.`,
  );
  process.exit(1);
}

console.log(`[mydrunner] building client in ${clientDir}`);
execFileSync("pnpm", ["--filter", "@mydrunner/client", "build"], {
  cwd: mydrunnerRepo,
  stdio: "inherit",
  env: { ...process.env, VITE_BASE: "/games/mydrunner/" },
});

rmSync(outDir, { recursive: true, force: true });
cpSync(clientDist, outDir, { recursive: true });
console.log(`[mydrunner] copied ${clientDist} -> ${outDir}`);
