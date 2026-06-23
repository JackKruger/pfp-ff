import type { GameActionBinding, GameInputManifest } from "@pfp/sdk";

export interface ControlSchema {
  actions: Record<string, GameActionBinding[]>;
}

export function schemaFromManifest(input: GameInputManifest | undefined): ControlSchema {
  return { actions: input?.actions ?? {} };
}
