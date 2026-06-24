import type { GameManifest, GamePresentationCategory } from "@pfp/sdk";
import { GAME_MANIFESTS } from "./games.generated.js";

/** Filterable library categories shown as tabs in the shell header. */
export type GameCategory = GamePresentationCategory;

export const CATEGORY_LABELS: Record<GameCategory, string> = {
  racing: "Racing",
  classic: "Classic",
  fighting: "Fighting",
  party: "Party",
};

/** Local extension: presentation metadata + tracks games that aren't implemented yet. */
export interface GameEntry extends GameManifest {
  disabled?: boolean;
  /** Primary library category (drives the filter tabs). */
  category: GameCategory;
  /** Signature neon used for borders, glows and CTAs on this game's surfaces. */
  accent: string;
  /** Emoji/glyph used in the generated placeholder when no thumbnail exists. */
  icon: string;
  /** One-line pitch shown on the featured hero banner. */
  blurb: string;
  /** Wide art used by the featured hero banner. Falls back to thumbnail. */
  heroArt?: string;
  /** Promote to the hero banner at the top of the library. */
  featured?: boolean;
}

/** Games known to the shell. Disabled entries are placeholders shown as Coming Soon. */
export const GAMES: GameEntry[] = GAME_MANIFESTS.map(toGameEntry);

function toGameEntry(manifest: GameManifest): GameEntry {
  const presentation = manifest.presentation ?? {};
  return {
    ...manifest,
    entry: devEntryFor(manifest) ?? manifest.entry,
    category: presentation.category ?? "classic",
    accent: presentation.accent ?? "#4f9dff",
    icon: presentation.icon ?? "🎮",
    blurb: presentation.blurb ?? "",
    heroArt: presentation.heroArt,
    featured: presentation.featured,
    disabled: presentation.disabled,
  };
}

function devEntryFor(manifest: GameManifest): string | undefined {
  if (!import.meta.env.DEV) return undefined;
  return manifest.build?.devPort ? `http://localhost:${manifest.build.devPort}/` : undefined;
}

export const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"] as const;
export const PLAYER_LABELS = ["P1", "P2", "P3", "P4"] as const;
