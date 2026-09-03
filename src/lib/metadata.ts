import { TitleKind } from "@/generated/prisma/client";
import { fetchImdbRating, isOmdbConfigured } from "@/lib/omdb";
import {
  getTmdbDetails,
  getTmdbExternalIds,
  isTmdbConfigured,
  searchTmdb,
  searchTmdbMulti,
} from "@/lib/tmdb";

export type TitleMetadata = {
  tmdbId: number | null;
  posterPath: string | null;
  imdbId: string | null;
  imdbRating: number | null;
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

  const imdbRating = imdbId ? await fetchImdbRating(imdbId) : null;

  return {
    tmdbId: details.tmdbId,
    posterPath: details.posterPath,
    imdbId,
    imdbRating,
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
      imdbId: resolved.imdbId ?? metadata.imdbId,
      imdbRating: resolved.imdbRating ?? metadata.imdbRating,
    };
  } catch {
    return metadata;
  }
};
