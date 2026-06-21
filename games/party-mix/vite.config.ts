import { defineConfig } from "vite";

export default defineConfig({
  base: "/games/party-mix/",
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5178, strictPort: true },
});
