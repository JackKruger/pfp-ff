import { defineConfig } from "vite";

export default defineConfig({
  base: "/games/raskulls/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
