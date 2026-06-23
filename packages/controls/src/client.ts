import type { ControlFrame, GameClient } from "@pfp/sdk";

export interface ControlClient {
  getLatestFrame(): ControlFrame | null;
  onFrame(callback: (frame: ControlFrame) => void): () => void;
  isPressed(slot: number, action: string): boolean;
  justPressed(slot: number, action: string): boolean;
  axis(slot: number, action: string): number;
  dispose(): void;
}

export function createControlClient(client: Pick<GameClient, "onInputFrame">): ControlClient {
  let latestFrame: ControlFrame | null = null;
  const handlers = new Set<(frame: ControlFrame) => void>();
  const unsubscribe = client.onInputFrame((frame) => {
    latestFrame = frame;
    for (const handler of handlers) handler(frame);
  });

  return {
    getLatestFrame() {
      return latestFrame;
    },
    onFrame(callback) {
      handlers.add(callback);
      return () => handlers.delete(callback);
    },
    isPressed(slot, action) {
      return actionState(latestFrame, slot, action)?.pressed ?? false;
    },
    justPressed(slot, action) {
      return actionState(latestFrame, slot, action)?.justPressed ?? false;
    },
    axis(slot, action) {
      return actionState(latestFrame, slot, action)?.value ?? 0;
    },
    dispose() {
      unsubscribe();
      handlers.clear();
      latestFrame = null;
    },
  };
}

function actionState(frame: ControlFrame | null, slot: number, action: string) {
  return frame?.players.find((player) => player.slot === slot)?.actions[action];
}
