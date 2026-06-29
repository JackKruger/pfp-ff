import { defineConfig } from "vite";

export default defineConfig({
  base: "/games/fowl-play/",
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5179, strictPort: true },
});
