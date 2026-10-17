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

/**
 * Why a credit is not part of the work (FIL-I16-3): it goes to «Otras
 * apariciones» instead of the filmography.
 */
export type AsideReason = "self" | "archive" | "uncredited" | "video";

/** One title in a filmography: a regular search result plus the credit detail. */
export type FilmographyEntry = TmdbCatalogResult & {
  /** Reparto: the character. */
  character: string | null;
  /** ISO date used for the order (release; for series, the person's first episode), null when unknown. */
  date: string | null;
  /** TMDB vote count: how known the title is (enrichment goes to the known ones first). */
  votes: number;
  /** Set when the credit is an appearance, not the work. */
  aside: AsideReason | null;
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
  /** The work: released titles of this role, newest first. */
  entries: FilmographyEntry[];
  /** Announced (future date) or undated titles: the next release first, undated last. */
  upcoming: FilmographyEntry[];
  /** «Otras apariciones»: as themself, archive footage, uncredited, music videos. */
  others: FilmographyEntry[];
  movies: number;
  series: number;
  /** First and last year of the work, null when none is dated. */
  years: { from: number; to: number } | null;
  /** Titles of the work in each role, for the role menu. */
  roles: Record<PersonRole, number>;
};

type CreditBase = {
  id?: number;
  media_type?: string;
  adult?: boolean;
  video?: boolean;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  /** Series: the person's first episode. */
  first_credit_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_count?: number;
  genre_ids?: number[];
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

const toEntry = (
  credit: CreditBase,
  character: string | null,
  aside: AsideReason | null,
): FilmographyEntry | null => {
  const kind = kindOf(credit);
  if (!kind || !credit.id || credit.adult) {
    return null;
  }
  const name = (kind === "MOVIE" ? credit.title : credit.name)?.trim() ?? "";
  if (!name) {
    return null;
  }
  // A series counts from the person's first episode (Dallas 1978 → Brad Pitt's 1987).
  const date =
    kind === "MOVIE"
      ? validDate(credit.release_date)
      : (validDate(credit.first_credit_air_date) ?? validDate(credit.first_air_date));
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
    votes: credit.vote_count ?? 0,
    aside,
  };
};

const ARCHIVE = /archive footage/i;
/** TMDB's Documentary genre: with no character, the person is appearing as themself (making-ofs). */
const DOCUMENTARY = 99;
const UNCREDITED = /\buncredited\b/i;

/** «Brad Pitt», «Brad Pitt / Self», «Self (archive footage)»: the person, not a role. */
const castAside = (credit: TmdbCastCredit, character: string | null, personName: string): AsideReason | null => {
  if (credit.video) {
    return "video";
  }
  if (!character) {
    return credit.genre_ids?.includes(DOCUMENTARY) ? "self" : null;
  }
  if (ARCHIVE.test(character)) {
    return "archive";
  }
  const plain = normalizePersonName(character);
  const person = normalizePersonName(personName);
  if ((person && plain === person) || /\bself\b/.test(plain)) {
    return "self";
  }
  if (UNCREDITED.test(character)) {
    return "uncredited";
  }
  return null;
};

const castEntries = (cast: readonly TmdbCastCredit[], personName: string) =>
  cast.flatMap((credit) => {
    const character = credit.character?.trim() || null;
    if (character && SELF_CHARACTER.test(character)) {
      return [];
    }
    // A series with a one-episode credit is a cameo, not part of the work.
    if (credit.media_type === "tv" && credit.episode_count === 1) {
      return [];
    }
    const entry = toEntry(credit, character, castAside(credit, character, personName));
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
    // Music videos and video compilations (Madonna, Aerosmith) are not films.
    const entry = toEntry(credit, null, credit.video ? "video" : null);
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

/**
 * The credits of one role, one row per title (`kind:tmdbId`), newest first.
 * `personName` lets reparto tell a role from the person playing themself.
 */
export const parseFilmography = (
  credits: TmdbCombinedCredits | null | undefined,
  role: PersonRole,
  personName = "",
): FilmographyEntry[] => {
  const raw =
    role === "reparto"
      ? castEntries(credits?.cast ?? [], personName)
      : crewEntries(credits?.crew ?? [], role);

  const byKey = new Map<string, FilmographyEntry>();
  for (const entry of raw) {
    const key = `${entry.kind}:${entry.tmdbId}`;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, entry);
    } else if (seen.aside && !entry.aside) {
      // A real credit on the same title wins over an appearance.
      byKey.set(key, { ...entry, character: entry.character ?? seen.character });
    } else if (!seen.character && entry.character && !entry.aside) {
      byKey.set(key, { ...seen, character: entry.character });
    }
  }
  return [...byKey.values()].sort(compareFilmography);
};

/** Today as `YYYY-MM-DD` in Mexico City: what «already released» means for the user. */
export const todayIso = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(now);

/** Next release first; undated ones last, by name. */
const compareUpcoming = (a: FilmographyEntry, b: FilmographyEntry) => {
  if (a.date && b.date && a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }
  if (Boolean(a.date) !== Boolean(b.date)) {
    return a.date ? -1 : 1;
  }
  return a.name.localeCompare(b.name, "es");
};

/** The work, the announced titles and the appearances of one parsed role. */
export const splitFilmography = (entries: readonly FilmographyEntry[], today: string) => {
  const work: FilmographyEntry[] = [];
  const upcoming: FilmographyEntry[] = [];
  const others: FilmographyEntry[] = [];
  for (const entry of entries) {
    if (entry.aside) {
      others.push(entry);
    } else if (!entry.date || entry.date > today) {
      upcoming.push(entry);
    } else {
      work.push(entry);
    }
  }
  return { work, upcoming: upcoming.sort(compareUpcoming), others };
};

export const summarizeFilmography = (
  person: PersonSummary,
  role: PersonRole,
  entries: FilmographyEntry[],
  { today = todayIso(), roles }: { today?: string; roles?: Partial<Record<PersonRole, number>> } = {},
): PersonFilmography => {
  const { work, upcoming, others } = splitFilmography(entries, today);
  const years = work.flatMap((entry) => (entry.year ? [entry.year] : []));
  return {
    person,
    role,
    entries: work,
    upcoming,
    others,
    movies: work.filter((entry) => entry.kind === "MOVIE").length,
    series: work.filter((entry) => entry.kind === "SERIES").length,
    years: years.length > 0 ? { from: Math.min(...years), to: Math.max(...years) } : null,
    roles: { director: 0, reparto: 0, fotografia: 0, ...roles, [role]: work.length },
  };
};

/** Titles of the work in every role, from one `combined_credits` payload. */
export const countRoles = (
  credits: TmdbCombinedCredits | null | undefined,
  personName: string,
  today: string,
): Record<PersonRole, number> => {
  const count = (role: PersonRole) =>
    splitFilmography(parseFilmography(credits, role, personName), today).work.length;
  return { director: count("director"), reparto: count("reparto"), fotografia: count("fotografia") };
};

/** A role is offered in the menu once its work has this many titles (Fincher's 6 making-ofs are not). */
export const ROLE_MENU_MIN_TITLES = 3;

/** The roles the person view offers: the current one plus any with enough work, in a fixed order. */
export const menuRoles = (filmography: Pick<PersonFilmography, "role" | "roles">) =>
  PERSON_ROLES.filter(
    (role) => role === filmography.role || filmography.roles[role] >= ROLE_MENU_MIN_TITLES,
  );

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
