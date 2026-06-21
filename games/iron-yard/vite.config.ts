import { defineConfig } from "vite";

export default defineConfig({
  base: "/games/iron-yard/",
  build: { target: "esnext" },
  server: { port: 5177, strictPort: true },
  optimizeDeps: { exclude: ["@dimforge/rapier3d-compat"] },
});
