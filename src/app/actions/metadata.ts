"use server";

import { metadataServicesConfigured, searchTmdbCatalog } from "@/lib/metadata";
import { TMDB_UNAVAILABLE_COPY, tmdbErrorMessage } from "@/lib/tmdb";

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
