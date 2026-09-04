"use server";

import { TitleKind } from "@/generated/prisma/browser";
import {
  metadataServicesConfigured,
  resolveTitleMetadata,
  searchTmdbCatalog,
  searchTmdbTitles,
} from "@/lib/metadata";
import { tmdbErrorMessage } from "@/lib/tmdb";

const missingKeyError =
  "Falta TMDB_API_KEY. Agrégala en el entorno para buscar títulos.";

export const getMetadataConfig = async () => metadataServicesConfigured();

export const searchTmdb = async (
  query: string,
  kind: TitleKind,
  year?: number | null,
) => {
  if (!metadataServicesConfigured().tmdb) {
    return { results: [], error: missingKeyError };
  }

  try {
    const results = await searchTmdbTitles(query, kind, year);
    return { results, error: null };
  } catch (error) {
    return { results: [], error: tmdbErrorMessage(error) };
  }
};

export const searchTmdbDiscover = async (query: string) => {
  if (!metadataServicesConfigured().tmdb) {
    return { results: [], error: missingKeyError };
  }

  try {
    const results = await searchTmdbCatalog(query);
    return { results, error: null };
  } catch (error) {
    return { results: [], error: tmdbErrorMessage(error) };
  }
};

export const enrichFromTmdb = async (tmdbId: number, kind: TitleKind) => {
  if (!metadataServicesConfigured().tmdb) {
    throw new Error(missingKeyError);
  }

  return resolveTitleMetadata(tmdbId, kind);
};
