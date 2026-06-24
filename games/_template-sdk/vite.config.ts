import { defineConfig } from "vite";

export default defineConfig({
  base: "/games/__GAME_ID__/",
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: __DEV_PORT__, strictPort: true },
});
