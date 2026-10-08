"use server";

import { metadataServicesConfigured, searchTmdbCatalog } from "@/lib/metadata";
import {
  isPersonRole,
  personNameMatchesQuery,
  type DirectorHit,
  type PersonFilmography,
  type PersonRole,
} from "@/lib/person-filmography";
import {
  getTmdbPersonFilmography,
  searchTmdbDirectors,
  searchTmdbMultiDirectors,
  TMDB_UNAVAILABLE_COPY,
  tmdbErrorMessage,
} from "@/lib/tmdb";

/** The director whose name is what was typed, for the «Ver filmografía» card. */
const directorNamed = async (query: string): Promise<DirectorHit | null> => {
  try {
    const hits = await searchTmdbMultiDirectors(query);
    return hits.find((hit) => personNameMatchesQuery(hit.name, query)) ?? null;
  } catch {
    return null;
  }
};

export const searchTmdbDiscover = async (query: string) => {
  if (!metadataServicesConfigured().tmdb) {
    return { results: [], director: null, error: TMDB_UNAVAILABLE_COPY };
  }

  try {
    const [results, director] = await Promise.all([
      searchTmdbCatalog(query),
      directorNamed(query),
    ]);
    return { results, director, error: null };
  } catch (error) {
    return { results: [], director: null, error: tmdbErrorMessage(error) };
  }
};

/** Buscar's «Director» chip. */
export const searchDirectors = async (query: string) => {
  if (!metadataServicesConfigured().tmdb) {
    return { directors: [] as DirectorHit[], error: TMDB_UNAVAILABLE_COPY };
  }

  try {
    return { directors: await searchTmdbDirectors(query), error: null };
  } catch (error) {
    return { directors: [] as DirectorHit[], error: tmdbErrorMessage(error) };
  }
};

export type PersonFilmographyResult =
  | { ok: true; data: PersonFilmography }
  | { ok: false; error: string };

/** Filmography of one person and role (person view; Director chip with one clear match). */
export const loadPersonFilmography = async (
  personId: number,
  role: PersonRole,
): Promise<PersonFilmographyResult> => {
  if (!metadataServicesConfigured().tmdb) {
    return { ok: false, error: TMDB_UNAVAILABLE_COPY };
  }
  if (!Number.isInteger(personId) || personId <= 0 || !isPersonRole(role)) {
    return { ok: false, error: "Esa persona no es válida." };
  }

  try {
    return { ok: true, data: await getTmdbPersonFilmography(personId, role) };
  } catch (error) {
    return { ok: false, error: tmdbErrorMessage(error) };
  }
};
