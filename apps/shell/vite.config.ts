import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILT_GAME_IDS } from "./src/buildGames.js";

function copyBuiltGames(): Plugin {
  return {
    name: "copy-built-games",
    closeBundle() {
      for (const id of BUILT_GAME_IDS) {
        const source = fileURLToPath(new URL(`../../games/${id}/dist`, import.meta.url));
        const target = fileURLToPath(new URL(`./dist/games/${id}`, import.meta.url));
        if (!existsSync(source)) {
          throw new Error(`${id} build missing; run \`pnpm --filter @pfp/${id} build\` first.`);
        }
        rmSync(target, { recursive: true, force: true });
        mkdirSync(dirname(target), { recursive: true });
        cpSync(source, target, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyBuiltGames()],
  server: {
    port: 5173,
  },
});
