import { defineConfig } from "vite";

export default defineConfig({
  base: "/games/pong/",
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5175, strictPort: true },
});
