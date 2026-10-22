"use server";

import { metadataServicesConfigured, searchTmdbCatalogPage } from "@/lib/metadata";
import { requireUserId } from "@/lib/session";
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
  type TmdbCatalogResult,
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

/** What one search answers: a page of titles and how far the list goes (FIL-I22-4). */
export type TmdbDiscoverAnswer = {
  results: TmdbCatalogResult[];
  director: DirectorHit | null;
  error: string | null;
  page: number;
  totalPages: number;
  /** Titles TMDB has for the words, people taken off as far as this page knows. */
  total: number;
};

const NO_PAGE = { page: 1, totalPages: 0, total: 0 };

// Each action spends TMDB quota, so it needs a session like any other (FIL-I10-6 L3):
// Server Functions can be invoked by POSTing to any path, public ones included.
export const searchTmdbDiscover = async (query: string, page = 1): Promise<TmdbDiscoverAnswer> => {
  await requireUserId();
  if (!metadataServicesConfigured().tmdb) {
    return { results: [], director: null, error: TMDB_UNAVAILABLE_COPY, ...NO_PAGE };
  }
  const wanted = Number.isInteger(page) && page > 1 ? Math.min(page, 50) : 1;

  try {
    const [found, director] = await Promise.all([
      searchTmdbCatalogPage(query, wanted),
      // The director card belongs to the first page only.
      wanted === 1 ? directorNamed(query) : Promise.resolve(null),
    ]);
    return {
      results: found.results,
      director,
      error: null,
      page: found.page,
      totalPages: found.totalPages,
      total: Math.max(found.results.length, found.totalResults - found.people),
    };
  } catch (error) {
    return { results: [], director: null, error: tmdbErrorMessage(error), ...NO_PAGE };
  }
};

/** Buscar's «Director» chip. */
export const searchDirectors = async (query: string) => {
  await requireUserId();
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
  await requireUserId();
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
