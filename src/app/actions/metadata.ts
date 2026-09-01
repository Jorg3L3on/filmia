"use server";

import { TitleKind } from "@/generated/prisma/client";
import {
  metadataServicesConfigured,
  resolveTitleMetadata,
  searchTmdbTitles,
} from "@/lib/metadata";

export const getMetadataConfig = async () => metadataServicesConfigured();

export const searchTmdb = async (
  query: string,
  kind: TitleKind,
  year?: number | null,
) => {
  if (!metadataServicesConfigured().tmdb) {
    return [];
  }

  try {
    return await searchTmdbTitles(query, kind, year);
  } catch {
    return [];
  }
};

export const enrichFromTmdb = async (tmdbId: number, kind: TitleKind) => {
  if (!metadataServicesConfigured().tmdb) {
    throw new Error("TMDB no está configurado.");
  }

  return resolveTitleMetadata(tmdbId, kind);
};
