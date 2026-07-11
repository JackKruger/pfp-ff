import { createControlClient, type ControlClient } from "@pfp/controls";
import { createGameClient, type GameClient } from "@pfp/sdk";

export interface PfpRuntime {
  client: GameClient;
  controls: ControlClient;
}

export function createPfpRuntime(): PfpRuntime {
  const client = createGameClient();
  const controls = createControlClient(client);
  return { client, controls };
}
