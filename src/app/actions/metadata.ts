"use server";

import { TitleKind } from "@/db";
import {
  metadataServicesConfigured,
  resolveTitleMetadata,
  searchTmdbCatalog,
  searchTmdbTitles,
} from "@/lib/metadata";
import { TMDB_UNAVAILABLE_COPY, tmdbErrorMessage } from "@/lib/tmdb";

export const getMetadataConfig = async () => metadataServicesConfigured();

export const searchTmdb = async (
  query: string,
  kind: TitleKind,
  year?: number | null,
) => {
  if (!metadataServicesConfigured().tmdb) {
    return { results: [], error: TMDB_UNAVAILABLE_COPY };
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
    return { results: [], error: TMDB_UNAVAILABLE_COPY };
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
    throw new Error(TMDB_UNAVAILABLE_COPY);
  }

  return resolveTitleMetadata(tmdbId, kind);
};
