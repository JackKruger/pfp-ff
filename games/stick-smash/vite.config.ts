import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/games/stick-smash/",
  build: { target: "esnext" },
  server: { port: 5178, strictPort: true },
  resolve: {
    alias: {
      "cannon-es": fileURLToPath(new URL("./upstream/src/physics/cannon-shim.js", import.meta.url)),
    },
  },
  optimizeDeps: { exclude: ["@dimforge/rapier3d-compat"] },
});
