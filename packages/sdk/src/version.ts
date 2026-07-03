/**
 * The version of the game contract this SDK implements. Games declare the range
 * they target via the `sdk` field in their manifest (e.g. "^1.0.0"); the shell
 * host checks that declaration against this value. Semver: breaking contract
 * changes bump major, additive changes bump minor.
 */
export const SDK_VERSION = "1.1.0";

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export function parseVersion(input: string): SemVer {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(input.trim());
  if (!match) throw new Error(`Invalid semver: "${input}"`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function gte(a: SemVer, b: SemVer): boolean {
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch >= b.patch;
}

/**
 * Minimal semver range check supporting the small subset we need:
 * `*` / `""` (any), exact `1.2.3`, caret `^1.2.3`, and tilde `~1.2.3`.
 * Good enough for manifest compatibility checks without pulling in a dependency.
 */
export function satisfies(version: string, range: string): boolean {
  const trimmed = range.trim();
  if (trimmed === "" || trimmed === "*") return true;

  const v = parseVersion(version);
  const operator = trimmed[0];

  if (operator === "^") {
    const r = parseVersion(trimmed.slice(1));
    if (r.major > 0) return v.major === r.major && gte(v, r);
    if (r.minor > 0) return v.major === 0 && v.minor === r.minor && gte(v, r);
    return v.major === 0 && v.minor === 0 && v.patch === r.patch;
  }

  if (operator === "~") {
    const r = parseVersion(trimmed.slice(1));
    return v.major === r.major && v.minor === r.minor && gte(v, r);
  }

  const r = parseVersion(trimmed);
  return v.major === r.major && v.minor === r.minor && v.patch === r.patch;
}
