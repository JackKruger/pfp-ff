import type { GameManifest, GameSettingDef } from "@pfp/sdk";

export type GameSettingsValue = boolean | number | string;
export type GameSettingsState = Record<string, GameSettingsValue>;

export function defaultSettingsFor(game: Pick<GameManifest, "settings">): GameSettingsState {
  const settings: GameSettingsState = {};
  for (const field of game.settings?.fields ?? []) {
    settings[field.id] = field.default;
  }
  return settings;
}

export function validateSettingsFor(
  game: Pick<GameManifest, "settings">,
  input: Record<string, unknown>,
): { ok: true; value: GameSettingsState } | { ok: false; errors: string[] } {
  const fields = game.settings?.fields ?? [];
  const knownIds = new Set(fields.map((field) => field.id));
  const errors: string[] = [];
  const value: GameSettingsState = {};

  for (const id of Object.keys(input)) {
    if (!knownIds.has(id)) errors.push(`Unknown setting "${id}"`);
  }

  for (const field of fields) {
    const candidate = input[field.id] ?? field.default;
    const normalized = normalizeSettingValue(field, candidate);
    if (normalized.ok) {
      value[field.id] = normalized.value;
    } else {
      errors.push(normalized.error);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

export function setGameSetting(
  game: Pick<GameManifest, "settings">,
  current: GameSettingsState,
  id: string,
  next: unknown,
): GameSettingsState {
  const field = game.settings?.fields.find((candidate) => candidate.id === id);
  if (!field) return current;

  const normalized = normalizeSettingValue(field, next);
  if (!normalized.ok) return current;
  return { ...current, [id]: normalized.value };
}

function normalizeSettingValue(
  field: GameSettingDef,
  value: unknown,
): { ok: true; value: GameSettingsValue } | { ok: false; error: string } {
  switch (field.type) {
    case "boolean":
      return typeof value === "boolean"
        ? { ok: true, value }
        : { ok: false, error: `Setting "${field.id}" must be a boolean` };
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? validateNumberSetting(field, value)
        : { ok: false, error: `Setting "${field.id}" must be a finite number` };
    case "choice":
      return typeof value === "string" && field.options.some((option) => option.value === value)
        ? { ok: true, value }
        : { ok: false, error: `Setting "${field.id}" must be one of its declared choices` };
  }
}

function validateNumberSetting(
  field: Extract<GameSettingDef, { type: "number" }>,
  value: number,
): { ok: true; value: number } | { ok: false; error: string } {
  if (value < field.min || value > field.max) {
    return {
      ok: false,
      error: `Setting "${field.id}" must be between ${field.min} and ${field.max}`,
    };
  }
  return { ok: true, value };
}
