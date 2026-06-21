import { SDK_VERSION } from "@pfp/sdk";
import "./style.css";

// Phase 0 boot screen. The real shell (game grid, pairing, stats) lands in
// Phase 4; this just proves the workspace wires together and the app boots.
const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.innerHTML = `
    <main class="boot">
      <h1>PFP-FF</h1>
      <p>Couch Multiplayer Platform</p>
      <p class="version">contract v${SDK_VERSION}</p>
    </main>
  `;
}
