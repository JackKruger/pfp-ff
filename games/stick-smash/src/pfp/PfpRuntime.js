import { createControlClient } from '@pfp/controls';
import { createGameClient } from '@pfp/sdk';

export function createPfpRuntime() {
  const client = createGameClient();
  const controls = createControlClient(client);
  return { client, controls };
}
