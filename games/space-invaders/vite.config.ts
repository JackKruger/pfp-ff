import { defineConfig } from "vite";

export default defineConfig({
  base: "/games/space-invaders/",
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5176, strictPort: true },
});