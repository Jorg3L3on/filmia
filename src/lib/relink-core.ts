import type { TitleKind } from "@/db";
import { TITLE_KINDS } from "@/lib/labels";

/** A TMDB result the user picked as the right film for their entry. */
export type RelinkPick = {
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
};

const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Validate what the client sends; null when it is not a usable TMDB pick. */
export const parseRelinkPick = (input: unknown): RelinkPick | null => {
  if (!input || typeof input !== "object") {
    return null;
  }
  const raw = input as Record<string, unknown>;
  const tmdbId = Number(raw.tmdbId);
  const kind = raw.kind;
  const name = optionalText(raw.name);
  const year = raw.year == null ? null : Number(raw.year);

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return null;
  }
  if (typeof kind !== "string" || !TITLE_KINDS.includes(kind as TitleKind)) {
    return null;
  }
  if (!name) {
    return null;
  }

  return {
    tmdbId,
    kind: kind as TitleKind,
    name,
    originalName: optionalText(raw.originalName),
    year: year != null && Number.isInteger(year) ? year : null,
    posterPath: optionalText(raw.posterPath),
  };
};

export type RelinkPlan =
  | { kind: "same" }
  | { kind: "duplicate"; titleId: string }
  | { kind: "relink" };

/**
 * Re-linking only moves the user's entry to another catalog row. It is a no-op
 * when it already points there, and refused when the user already has a
 * separate entry for the target film (one entry per film per user).
 */
export const planRelink = ({
  titleId,
  currentCatalogId,
  targetCatalogId,
  ownedTitleIdForTarget,
}: {
  titleId: string;
  currentCatalogId: string | null;
  targetCatalogId: string;
  ownedTitleIdForTarget: string | null;
}): RelinkPlan => {
  if (currentCatalogId === targetCatalogId) {
    return { kind: "same" };
  }
  if (ownedTitleIdForTarget && ownedTitleIdForTarget !== titleId) {
    return { kind: "duplicate", titleId: ownedTitleIdForTarget };
  }
  return { kind: "relink" };
};

/**
 * Search hits that can replace the current match: same kind (a film stays a
 * film, a series a series — series progress and status lists depend on it),
 * minus the film it already points at.
 */
export const relinkCandidates = <T extends { tmdbId: number; kind: TitleKind }>(
  results: readonly T[],
  current: { kind: TitleKind; tmdbId: number | null },
): T[] =>
  results.filter((result) => result.kind === current.kind && result.tmdbId !== current.tmdbId);
