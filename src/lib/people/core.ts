import type {
  TmdbCastCredit,
  TmdbCombinedCredits,
  TmdbCrewCredit,
} from "@/lib/person-filmography";

/**
 * The people behind the films you saw, as Universo, Cine and «¿Las viste?» read them: who is in
 * `Catalog.tmdbPeople`, and a person's released films in one role (the «N» of «n de N»). Pure.
 */

/** A filmography this short is shown whole. */
export const PERSON_FULL_MAX = 8;
/** Longer ones become «esenciales» of this many; the rest stays in Filmografía. */
export const ESENCIALES_SIZE = 6;
/** What counts as a film of someone's work: known enough to have an opinion about. */
export const PERSON_MIN_VOTES = 50;

/** A film from a person's credits, before it has a `Catalog` row. Movies only. */
export type PersonFilm = {
  tmdbId: number;
  name: string;
  originalName: string | null;
  year: number | null;
  /** ISO day, the release order. */
  releaseDate: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  voteAverage: number;
  voteCount: number;
  /** TMDB genre ids, from the list payload. */
  genreIds: number[];
};

const isoDay = (value: string | undefined | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

const compareRelease = (a: PersonFilm, b: PersonFilm) =>
  (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999") || a.tmdbId - b.tmdbId;

/** Today as an ISO day, the cut for «released». */
export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

export type SeedCandidate = {
  catalogId: string;
  tmdbId: number;
  kind: "MOVIE" | "SERIES";
  name: string;
  watched: boolean;
  /** 1–10, null when unrated. */
  rating: number | null;
  favorite: boolean;
  createdAt: Date;
};

/**
 * Which films of the library seed suggestions, best first: favoritas, then the best rated,
 * then the first added. Only watched films: Quiero ver filters, it never seeds (428cc697).
 */
export const rankSeeds = <T extends SeedCandidate>(titles: readonly T[]): T[] =>
  titles
    .filter((title) => title.watched && title.kind === "MOVIE")
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        (b.rating ?? 0) - (a.rating ?? 0) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );

// ---------------------------------------------------------------------------
// A person's work in one role
// ---------------------------------------------------------------------------

export const PERSON_ROLES = ["director", "fotografia", "musica", "reparto"] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

export const isPersonRole = (value: unknown): value is PersonRole => PERSON_ROLES.includes(value as PersonRole);

const CREW_JOB: Record<Exclude<PersonRole, "reparto">, string> = {
  director: "Director",
  fotografia: "Director of Photography",
  musica: "Original Music Composer",
};

const SELF = /^(self|himself|herself|themselves|themself)\b/i;
const ASIDE = /\b(uncredited|archive footage|voice)\b/i;
const DOCUMENTARY = 99;

type CreditMovie = (TmdbCastCredit | TmdbCrewCredit) & { vote_average?: number };

const creditToFilm = (credit: CreditMovie): PersonFilm | null => {
  if (credit.media_type !== "movie" || !credit.id || credit.adult || credit.video) {
    return null;
  }
  const name = credit.title?.trim();
  if (!name || credit.genre_ids?.includes(DOCUMENTARY)) {
    return null;
  }
  const releaseDate = isoDay(credit.release_date);
  return {
    tmdbId: credit.id,
    name,
    originalName: credit.original_title?.trim() || null,
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    releaseDate,
    posterPath: credit.poster_path ?? null,
    backdropPath: credit.backdrop_path ?? null,
    overview: credit.overview?.trim() || null,
    voteAverage: credit.vote_average ?? 0,
    voteCount: credit.vote_count ?? 0,
    genreIds: credit.genre_ids ?? [],
  };
};

/**
 * A person's released films in one role with at least `PERSON_MIN_VOTES` votes: the «N» of
 * «n de N». Acting skips appearances as themself, archive footage, voices and uncredited parts.
 */
export const personRoleFilms = (
  credits: TmdbCombinedCredits,
  role: PersonRole,
  today: string,
): PersonFilm[] => {
  const raw: CreditMovie[] =
    role === "reparto"
      ? (credits.cast ?? []).filter((credit) => {
          const character = credit.character?.trim() ?? "";
          return !SELF.test(character) && !ASIDE.test(character);
        })
      : (credits.crew ?? []).filter((credit) => credit.job === CREW_JOB[role]);
  const byId = new Map<number, PersonFilm>();
  for (const credit of raw) {
    const film = creditToFilm(credit);
    if (
      film &&
      film.releaseDate &&
      film.releaseDate <= today &&
      film.voteCount >= PERSON_MIN_VOTES &&
      !byId.has(film.tmdbId)
    ) {
      byId.set(film.tmdbId, film);
    }
  }
  return [...byId.values()].sort(compareRelease);
};

/** «Phil Lord» + «Christopher Miller» → «Lord & Miller». */
export const duoName = (a: string, b: string) => {
  const last = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;
  return `${last(a)} & ${last(b)}`;
};

/** Ratings shrunk towards 6.5 by their vote count: a 9.0 with 60 votes does not beat a 8.4 with 20 000. */
export const bayesianRating = (film: Pick<PersonFilm, "voteAverage" | "voteCount">, prior = 6.5, weight = 500) =>
  (film.voteAverage * film.voteCount + prior * weight) / (film.voteCount + weight);

/**
 * The «esenciales»: what the person is best known for, the films the account can stream first,
 * and anything already seen always in (lo visto cuenta). Back in release order.
 */
export const pickEsenciales = (
  films: readonly PersonFilm[],
  seenTmdbIds: ReadonlySet<number>,
  onMyPlatforms: ReadonlySet<number>,
  size = ESENCIALES_SIZE,
): PersonFilm[] => {
  const seen = films.filter((film) => seenTmdbIds.has(film.tmdbId)).slice(0, Math.max(1, size - 3));
  const rest = films
    .filter((film) => !seenTmdbIds.has(film.tmdbId))
    .map((film) => ({ film, score: bayesianRating(film) + (onMyPlatforms.has(film.tmdbId) ? 0.4 : 0) }))
    .sort((a, b) => b.score - a.score || b.film.voteCount - a.film.voteCount)
    .slice(0, size - seen.length)
    .map((item) => item.film);
  return [...seen, ...rest].sort(compareRelease);
};

// ---------------------------------------------------------------------------
// Who is in a film: `Catalog.tmdbPeople`
// ---------------------------------------------------------------------------

export type ThreadPersonRole = "director" | "dp" | "composer" | "cast";

export type ThreadPerson = { id: number; name: string; role: ThreadPersonRole; profilePath?: string | null };

export type ThreadFilm = { catalogId: string; name: string; people: readonly ThreadPerson[] };

/** `Catalog.tmdbPeople` as Universo reads it: the roles above, anything else ignored. */
export const parseThreadPeople = (value: unknown): ThreadPerson[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const people: ThreadPerson[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = Number(record.id);
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const role = record.role;
    const cast = role === "cast" && (typeof record.order !== "number" || record.order < 4);
    if (
      Number.isInteger(id) &&
      id > 0 &&
      name &&
      (role === "director" || role === "dp" || role === "composer" || cast)
    ) {
      const profilePath = typeof record.profilePath === "string" && record.profilePath ? record.profilePath : null;
      people.push({ id, name, role: role as ThreadPersonRole, profilePath });
    }
  }
  return people;
};

/** Which credit list holds a person's «N». */
export const personRoleOfThread = (role: ThreadPersonRole): PersonRole =>
  role === "director" ? "director" : role === "dp" ? "fotografia" : role === "composer" ? "musica" : "reparto";
