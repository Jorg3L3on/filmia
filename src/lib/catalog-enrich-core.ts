import type { TitleMetadata } from "@/lib/metadata";
import type { TmdbGenre, TmdbKeyword, TmdbPerson } from "@/lib/tmdb";

/** The catalog columns enrichment may write. */
export type CatalogEnrichmentPatch = Partial<{
  name: string;
  originalName: string;
  year: number;
  posterPath: string;
  backdropPath: string;
  runtimeMinutes: number;
  imdbId: string;
  imdbRating: number;
  imdbVotes: number;
  awards: string;
  overview: string;
  tmdbGenres: TmdbGenre[];
  tmdbKeywords: TmdbKeyword[];
  tmdbPeople: TmdbPerson[];
  originalLanguage: string;
  posterAmbient: string;
}>;

const text = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const positive = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) && value > 0 ? value : undefined;

const nonEmpty = <T>(value: T[] | null | undefined) =>
  value && value.length > 0 ? value : undefined;

/**
 * Only what the lookup actually returned. The catalog is shared, so a missing
 * value — a dead OMDb key, a TMDB hiccup, a field TMDB lacks — must never
 * overwrite data another user already sees; the column simply stays as is.
 */
export const catalogEnrichmentPatch = (
  resolved: TitleMetadata,
  extra: { posterAmbient?: string | null } = {},
): CatalogEnrichmentPatch => {
  const patch: CatalogEnrichmentPatch = {
    name: text(resolved.name),
    originalName: text(resolved.originalName),
    year: positive(resolved.year),
    posterPath: text(resolved.posterPath),
    backdropPath: text(resolved.backdropPath),
    runtimeMinutes: positive(resolved.runtimeMinutes),
    imdbId: text(resolved.imdbId),
    imdbRating: positive(resolved.imdbRating),
    imdbVotes: positive(resolved.imdbVotes),
    awards: text(resolved.awards),
    overview: text(resolved.overview),
    tmdbGenres: nonEmpty(resolved.tmdbGenres),
    tmdbKeywords: nonEmpty(resolved.tmdbKeywords),
    tmdbPeople: nonEmpty(resolved.tmdbPeople),
    originalLanguage: text(resolved.originalLanguage),
    posterAmbient: text(extra.posterAmbient),
  };

  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as CatalogEnrichmentPatch;
};

const isEmpty = (value: unknown) =>
  value == null || value === "" || (Array.isArray(value) && value.length === 0);

/** Backfills: keep only the fields the row is still missing; never replace stored data. */
export const onlyMissingFields = (
  patch: CatalogEnrichmentPatch,
  current: Record<string, unknown>,
): CatalogEnrichmentPatch =>
  Object.fromEntries(
    Object.entries(patch).filter(([key]) => isEmpty(current[key])),
  ) as CatalogEnrichmentPatch;
