/**
 * Quinielas de premios (FIL-I51-9): what `npm run quiniela:tmdb` does to a ceremony file written by
 * hand. Every nominee gets its TMDB id, Mexican title and poster: by IMDb id when the file has one
 * (`/find`, films and series), else by searching the title (with the year for films). People get
 * their TMDB id and photo the same way. Plain `fetch` (it runs outside Next) and injectable, so the
 * test runs without the network.
 */
import type { QuinielaCeremonyFile, QuinielaNominee } from "@/lib/quinielas/ceremony-core";

type Fetch = (url: string) => Promise<Response>;

type FindResult = {
  movie_results?: { id: number; title?: string | null; poster_path?: string | null }[];
  tv_results?: { id: number; name?: string | null; poster_path?: string | null }[];
  person_results?: { id: number; profile_path?: string | null }[];
};

type SearchResult = {
  results?: { id: number; title?: string | null; name?: string | null; poster_path?: string | null; profile_path?: string | null }[];
};

export type TmdbFillReport = { filled: number; missing: string[]; lookups: number };

const BASE = "https://api.themoviedb.org/3";

const tmdbUrl = (path: string, apiKey: string, params: Record<string, string> = {}) => {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("language", "es-MX");
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
};

/**
 * Fills the TMDB fields of every nominee in place, keeping any value the file already has. Films
 * are searched with `year − 1` (the awards of 2027 judge the films of 2026); series without a year.
 */
export const fillCeremonyFromTmdb = async (
  file: QuinielaCeremonyFile,
  apiKey: string,
  fetchImpl: Fetch = (url) => fetch(url),
): Promise<TmdbFillReport> => {
  const cache = new Map<string, unknown>();
  let lookups = 0;
  const get = async <T>(url: string): Promise<T | null> => {
    if (!cache.has(url)) {
      lookups += 1;
      const response = await fetchImpl(url);
      cache.set(url, response.ok ? await response.json() : null);
    }
    return cache.get(url) as T | null;
  };
  const report: TmdbFillReport = { filled: 0, missing: [], lookups: 0 };

  const fillWork = async (nominee: QuinielaNominee, where: string) => {
    const work = nominee.work;
    if (work.tmdbId && work.posterPath !== undefined && work.titleEs !== undefined) {
      return;
    }
    let found: { id: number; title: string | null; poster: string | null } | null = null;
    if (work.imdbId) {
      const result = await get<FindResult>(tmdbUrl(`/find/${work.imdbId}`, apiKey, { external_source: "imdb_id" }));
      const movie = result?.movie_results?.[0];
      const tv = result?.tv_results?.[0];
      const asMovie = movie ? { id: movie.id, title: movie.title ?? null, poster: movie.poster_path ?? null } : null;
      const asTv = tv ? { id: tv.id, title: tv.name ?? null, poster: tv.poster_path ?? null } : null;
      found = work.kind === "tv" ? (asTv ?? asMovie) : (asMovie ?? asTv);
    }
    if (!found) {
      const path = work.kind === "tv" ? "/search/tv" : "/search/movie";
      const params: Record<string, string> = { query: work.title };
      if (work.kind === "movie") {
        params.year = String(file.year - 1);
      }
      const hit = (await get<SearchResult>(tmdbUrl(path, apiKey, params)))?.results?.[0];
      found = hit ? { id: hit.id, title: (work.kind === "tv" ? hit.name : hit.title) ?? null, poster: hit.poster_path ?? null } : null;
    }
    if (!found) {
      report.missing.push(`${where}: ${work.title}`);
      return;
    }
    work.tmdbId ??= found.id;
    work.titleEs ??= found.title?.trim() || null;
    if (work.posterPath === undefined || work.posterPath === null) {
      work.posterPath = found.poster;
    }
    report.filled += 1;
  };

  const fillPerson = async (nominee: QuinielaNominee, where: string) => {
    const person = nominee.person;
    if (!person || person.tmdbId) {
      return;
    }
    const byImdb = person.imdbId
      ? (await get<FindResult>(tmdbUrl(`/find/${person.imdbId}`, apiKey, { external_source: "imdb_id" })))?.person_results?.[0]
      : undefined;
    const hit = byImdb ?? (await get<SearchResult>(tmdbUrl("/search/person", apiKey, { query: person.name })))?.results?.[0];
    if (!hit) {
      report.missing.push(`${where}: ${person.name}`);
      return;
    }
    person.tmdbId = hit.id;
    person.profilePath = hit.profile_path ?? null;
  };

  for (const category of file.categories) {
    for (const nominee of category.nominees) {
      const where = `${category.id}/${nominee.id}`;
      await fillWork(nominee, where);
      await fillPerson(nominee, where);
    }
  }
  report.lookups = lookups;
  return report;
};
