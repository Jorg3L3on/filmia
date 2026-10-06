import { TitleKind } from "@/db";
import { fetchImdbScore, isOmdbConfigured } from "@/lib/omdb";
import {
  getTmdbDetails,
  getTmdbExternalIds,
  isTmdbConfigured,
  searchTmdb,
  searchTmdbMulti,
  type TmdbGenre,
  type TmdbKeyword,
  type TmdbPerson,
} from "@/lib/tmdb";

export type TitleMetadata = {
  tmdbId: number | null;
  posterPath: string | null;
  backdropPath?: string | null;
  runtimeMinutes?: number | null;
  imdbId: string | null;
  imdbRating: number | null;
  imdbVotes?: number | null;
  /** Raw OMDb awards sentence (see `src/lib/awards.ts`). */
  awards?: string | null;
  tmdbGenres: TmdbGenre[];
  tmdbKeywords?: TmdbKeyword[];
  tmdbPeople?: TmdbPerson[];
  originalLanguage?: string | null;
  overview?: string | null;
  name?: string;
  originalName?: string | null;
  year?: number | null;
};

export const metadataServicesConfigured = () => ({
  tmdb: isTmdbConfigured(),
  omdb: isOmdbConfigured(),
});

export const resolveTitleMetadata = async (
  tmdbId: number,
  kind: TitleKind,
): Promise<TitleMetadata> => {
  const [details, imdbId] = await Promise.all([
    getTmdbDetails(tmdbId, kind),
    getTmdbExternalIds(tmdbId, kind),
  ]);

  const score = imdbId
    ? await fetchImdbScore(imdbId)
    : { rating: null, votes: null, awards: null };

  return {
    tmdbId: details.tmdbId,
    posterPath: details.posterPath,
    backdropPath: details.backdropPath,
    runtimeMinutes: details.runtimeMinutes,
    imdbId,
    imdbRating: score.rating,
    imdbVotes: score.votes,
    awards: score.awards,
    tmdbGenres: details.genres,
    tmdbKeywords: details.keywords,
    tmdbPeople: details.people,
    originalLanguage: details.originalLanguage,
    overview: details.overview,
    name: details.name,
    originalName: details.originalName,
    year: details.year,
  };
};

export const searchTmdbTitles = searchTmdb;
export const searchTmdbCatalog = searchTmdbMulti;

export const parseOptionalTmdbId = (value: FormDataEntryValue | null) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return null;
  }

  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

export const parseOptionalImdbRating = (value: FormDataEntryValue | null) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return null;
  }

  const rating = Number(raw);
  return Number.isFinite(rating) ? rating : null;
};

export const readMetadataFields = (formData: FormData): TitleMetadata => ({
  tmdbId: parseOptionalTmdbId(formData.get("tmdbId")),
  posterPath: String(formData.get("posterPath") ?? "").trim() || null,
  imdbId: String(formData.get("imdbId") ?? "").trim() || null,
  imdbRating: parseOptionalImdbRating(formData.get("imdbRating")),
  tmdbGenres: [],
});

export const enrichMetadataOnSave = async (
  metadata: TitleMetadata,
  kind: TitleKind,
): Promise<TitleMetadata> => {
  if (!metadata.tmdbId) {
    return metadata;
  }

  if (!isTmdbConfigured()) {
    return metadata;
  }

  try {
    const resolved = await resolveTitleMetadata(metadata.tmdbId, kind);
    return {
      ...resolved,
      posterPath: resolved.posterPath ?? metadata.posterPath,
      backdropPath: resolved.backdropPath ?? metadata.backdropPath,
      runtimeMinutes: resolved.runtimeMinutes ?? metadata.runtimeMinutes,
      imdbId: resolved.imdbId ?? metadata.imdbId,
      imdbRating: resolved.imdbRating ?? metadata.imdbRating,
      imdbVotes: resolved.imdbVotes ?? metadata.imdbVotes ?? null,
      awards: resolved.awards ?? metadata.awards ?? null,
      tmdbGenres:
        resolved.tmdbGenres.length > 0 ? resolved.tmdbGenres : metadata.tmdbGenres,
    };
  } catch {
    return metadata;
  }
};
