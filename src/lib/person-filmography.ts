import type { TitleKind } from "@/db";
import type { TmdbCatalogResult } from "@/lib/tmdb";

/**
 * Buscar's person view (FIL-I3-5): one filmography per person and role, for
 * `/buscar?persona=<tmdbPersonId>&rol=director|reparto|fotografia`. Pure
 * parsing of TMDB `combined_credits` plus the name rule behind the «Ver
 * filmografía» suggestion, so both are unit-tested without the network.
 */

export const PERSON_ROLES = ["director", "reparto", "fotografia"] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

export const isPersonRole = (value: unknown): value is PersonRole =>
  PERSON_ROLES.includes(value as PersonRole);

export const PERSON_ROLE_LABEL: Record<PersonRole, string> = {
  director: "Director",
  reparto: "Reparto",
  fotografia: "Dirección de fotografía",
};

/** One title in a filmography: a regular search result plus the credit detail. */
export type FilmographyEntry = TmdbCatalogResult & {
  /** Reparto: the character. */
  character: string | null;
  /** ISO date used for the order (release / first air date), null when unknown. */
  date: string | null;
};

export type PersonSummary = {
  id: number;
  name: string;
  profilePath: string | null;
  department: string | null;
};

export type PersonFilmography = {
  person: PersonSummary;
  role: PersonRole;
  entries: FilmographyEntry[];
  movies: number;
  series: number;
  /** First and last year with a dated credit, null when none is dated. */
  years: { from: number; to: number } | null;
};

type CreditBase = {
  id?: number;
  media_type?: string;
  adult?: boolean;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
};

export type TmdbCastCredit = CreditBase & { character?: string; episode_count?: number };
export type TmdbCrewCredit = CreditBase & { job?: string; department?: string; episode_count?: number };

export type TmdbCombinedCredits = {
  cast?: TmdbCastCredit[];
  crew?: TmdbCrewCredit[];
};

/** «Self», «Himself», «Self - Guest»: talk shows and making-ofs are not acting. */
const SELF_CHARACTER = /^(self|himself|herself|themselves|themself)\b/i;

const DIRECTOR_JOBS = new Set(["Director"]);
const SERIES_DIRECTOR_JOBS = new Set(["Director", "Creator"]);
const CINEMATOGRAPHY_JOBS = new Set(["Director of Photography"]);

const kindOf = (credit: CreditBase): TitleKind | null =>
  credit.media_type === "movie" ? "MOVIE" : credit.media_type === "tv" ? "SERIES" : null;

const validDate = (value: string | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

const toEntry = (credit: CreditBase, character: string | null): FilmographyEntry | null => {
  const kind = kindOf(credit);
  if (!kind || !credit.id || credit.adult) {
    return null;
  }
  const name = (kind === "MOVIE" ? credit.title : credit.name)?.trim() ?? "";
  if (!name) {
    return null;
  }
  const date = validDate(kind === "MOVIE" ? credit.release_date : credit.first_air_date);
  return {
    tmdbId: credit.id,
    kind,
    name,
    originalName: (kind === "MOVIE" ? credit.original_title : credit.original_name) ?? null,
    year: date ? Number(date.slice(0, 4)) : null,
    posterPath: credit.poster_path ?? null,
    backdropPath: credit.backdrop_path ?? null,
    overview: credit.overview?.trim() || null,
    character,
    date,
  };
};

const castEntries = (cast: readonly TmdbCastCredit[]) =>
  cast.flatMap((credit) => {
    const character = credit.character?.trim() || null;
    if (character && SELF_CHARACTER.test(character)) {
      return [];
    }
    // A series with a one-episode credit is a cameo, not part of the work.
    if (credit.media_type === "tv" && credit.episode_count === 1) {
      return [];
    }
    const entry = toEntry(credit, character);
    return entry ? [entry] : [];
  });

const crewEntries = (crew: readonly TmdbCrewCredit[], role: "director" | "fotografia") =>
  crew.flatMap((credit) => {
    const job = credit.job ?? "";
    const matches =
      role === "fotografia"
        ? CINEMATOGRAPHY_JOBS.has(job)
        : credit.media_type === "tv"
          ? SERIES_DIRECTOR_JOBS.has(job)
          : DIRECTOR_JOBS.has(job);
    if (!matches) {
      return [];
    }
    const entry = toEntry(credit, null);
    return entry ? [entry] : [];
  });

/** Most recent first; undated credits last, then by name. */
export const compareFilmography = (a: FilmographyEntry, b: FilmographyEntry) => {
  if (a.date && b.date && a.date !== b.date) {
    return a.date < b.date ? 1 : -1;
  }
  if (Boolean(a.date) !== Boolean(b.date)) {
    return a.date ? -1 : 1;
  }
  return a.name.localeCompare(b.name, "es");
};

/** The credits of one role, one row per title (`kind:tmdbId`), newest first. */
export const parseFilmography = (
  credits: TmdbCombinedCredits | null | undefined,
  role: PersonRole,
): FilmographyEntry[] => {
  const raw =
    role === "reparto"
      ? castEntries(credits?.cast ?? [])
      : crewEntries(credits?.crew ?? [], role);

  const byKey = new Map<string, FilmographyEntry>();
  for (const entry of raw) {
    const key = `${entry.kind}:${entry.tmdbId}`;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, entry);
    } else if (!seen.character && entry.character) {
      byKey.set(key, { ...seen, character: entry.character });
    }
  }
  return [...byKey.values()].sort(compareFilmography);
};

export const summarizeFilmography = (
  person: PersonSummary,
  role: PersonRole,
  entries: FilmographyEntry[],
): PersonFilmography => {
  const years = entries.flatMap((entry) => (entry.year ? [entry.year] : []));
  return {
    person,
    role,
    entries,
    movies: entries.filter((entry) => entry.kind === "MOVIE").length,
    series: entries.filter((entry) => entry.kind === "SERIES").length,
    years: years.length > 0 ? { from: Math.min(...years), to: Math.max(...years) } : null,
  };
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** «Director · 12 películas · 3 series», «Reparto · 40 títulos». */
export const personRoleLine = (summary: Pick<PersonFilmography, "role" | "movies" | "series">) => {
  const label = PERSON_ROLE_LABEL[summary.role];
  if (summary.role !== "director") {
    return `${label} · ${plural(summary.movies + summary.series, "título", "títulos")}`;
  }
  const parts = [label];
  if (summary.movies > 0) {
    parts.push(plural(summary.movies, "película", "películas"));
  }
  if (summary.series > 0) {
    parts.push(plural(summary.series, "serie", "series"));
  }
  return parts.join(" · ");
};

/** «1992–2023», or one year. */
export const personYearsLabel = (years: PersonFilmography["years"]) =>
  !years ? null : years.from === years.to ? String(years.from) : `${years.from}–${years.to}`;

/** Lowercase, no accents or punctuation, single spaces. */
export const normalizePersonName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Does what was typed name this person? Every typed word must be a whole word
 * of the name, and the surname (last word) must be among them: «david fincher»
 * and «fincher» match David Fincher; «david» or «fincer» do not.
 */
export const personNameMatchesQuery = (name: string, query: string) => {
  const nameWords = normalizePersonName(name).split(" ").filter(Boolean);
  const queryWords = normalizePersonName(query).split(" ").filter(Boolean);
  const surname = nameWords.at(-1);
  if (!surname || queryWords.length === 0) {
    return false;
  }
  return queryWords.every((word) => nameWords.includes(word)) && queryWords.includes(surname);
};

export type DirectorHit = {
  id: number;
  name: string;
  profilePath: string | null;
  popularity: number;
};

/**
 * Director mode: one clear match opens the person view; several (or none that
 * match by name) become cards to pick from; none at all is the empty state.
 */
export const resolveDirectorQuery = (
  hits: readonly DirectorHit[],
  query: string,
): { kind: "person"; hit: DirectorHit } | { kind: "choose"; hits: DirectorHit[] } | { kind: "none" } => {
  if (hits.length === 0) {
    return { kind: "none" };
  }
  const named = hits.filter((hit) => personNameMatchesQuery(hit.name, query));
  if (named.length === 1) {
    return { kind: "person", hit: named[0]! };
  }
  return { kind: "choose", hits: named.length > 1 ? named : [...hits] };
};

/** `/buscar?persona=…`: the person view, keeping what was typed for «atrás». */
export const buildPersonSearchHref = ({
  personId,
  role,
  name,
  query,
  mode,
}: {
  personId: number;
  role: PersonRole;
  name?: string | null;
  query?: string | null;
  mode?: "director" | null;
}) => {
  const params = new URLSearchParams();
  const q = query?.trim();
  if (q) {
    params.set("q", q);
  }
  if (mode) {
    params.set("tipo", mode);
  }
  params.set("persona", String(personId));
  params.set("rol", role);
  if (name?.trim()) {
    params.set("nombre", name.trim());
  }
  return `/buscar?${params.toString()}`;
};
