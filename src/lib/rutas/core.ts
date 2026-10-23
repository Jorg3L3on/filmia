import type {
  TmdbCastCredit,
  TmdbCombinedCredits,
  TmdbCrewCredit,
} from "@/lib/person-filmography";
import type { TmdbCollectionPayload } from "@/lib/tmdb";

/**
 * Rutas (FIL-I26): 3–8 films in an order with one line of why per step. This module is pure:
 * what a ruta is made of (from a TMDB collection or a person's credits), which film of the
 * library seeds it, what is face up, and where its lens goes in Hoy. The network lives in
 * `factories.ts`, the database in `store.ts`.
 */

export const RUTA_KINDS = ["coleccion", "persona", "titulo", "curada", "temporada"] as const;
export type RutaKind = (typeof RUTA_KINDS)[number];

export const RUTA_STATUSES = ["activa", "espera", "cerrada"] as const;
export type RutaStatus = (typeof RUTA_STATUSES)[number];

/** Hoy shows at most this many; the rest wait with no reminders. */
export const MAX_ACTIVE_RUTAS = 2;
export const RUTA_MIN_STEPS = 3;
export const RUTA_MAX_STEPS = 8;
/** A filmography this short is offered whole («Lord & Miller, los cinco»). */
export const PERSON_FULL_MAX = 8;
/** Longer ones become «esenciales» of this many; the rest stays in Filmografía. */
export const ESENCIALES_SIZE = 6;
/** What counts as a film of someone's work: known enough to have an opinion about. */
export const PERSON_MIN_VOTES = 50;

export const RUTA_EVENT_KINDS = ["ruta_started", "ruta_step_done", "ruta_closed"] as const;
export type RutaEventKind = (typeof RUTA_EVENT_KINDS)[number];

export const isRutaKind = (value: unknown): value is RutaKind =>
  RUTA_KINDS.includes(value as RutaKind);

export const isRutaStatus = (value: unknown): value is RutaStatus =>
  RUTA_STATUSES.includes(value as RutaStatus);

/** A film as a ruta needs it before it has a `Catalog` row. Movies only (decision 428cc697). */
export type RutaFilm = {
  tmdbId: number;
  name: string;
  originalName: string | null;
  year: number | null;
  /** ISO day, the order of the ruta. */
  releaseDate: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  voteAverage: number;
  voteCount: number;
  /** TMDB genre ids, from the list payload. */
  genreIds: number[];
};

export type RutaDraftStep = { film: RutaFilm; why: string; hint: string };

/** A ruta before it is stored: what a factory returns and `createRuta` writes. */
export type RutaDraft = {
  kind: RutaKind;
  title: string;
  shortTitle: string;
  reason: string;
  sourceKey: string;
  /** TMDB id of the library film it grew from, when there is one. */
  seedTmdbId: number | null;
  steps: RutaDraftStep[];
};

const NUMBER_WORDS: Record<number, string> = {
  2: "dos",
  3: "tres",
  4: "cuatro",
  5: "cinco",
  6: "seis",
  7: "siete",
  8: "ocho",
};

export const numberWord = (value: number) => NUMBER_WORDS[value] ?? String(value);

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const isoDay = (value: string | undefined | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

const compareRelease = (a: RutaFilm, b: RutaFilm) =>
  (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999") || a.tmdbId - b.tmdbId;

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
 * Which films of the library a ruta may grow from, best first: favoritas, then the best rated,
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
// Por colección
// ---------------------------------------------------------------------------

/** «El Señor de los Anillos - Colección» → «El Señor de los Anillos». */
export const collectionBaseName = (name: string) =>
  name
    .trim()
    .replace(/^(colecci[oó]n|saga)\s*[:\-–]?\s+/i, "")
    .replace(/\s*[(\[]?\s*[:\-–]?\s*(colecci[oó]n|collection|saga)\s*[)\]]?\s*$/i, "")
    .trim();

/** «El señor de los anillos: Las dos torres» inside its saga is «Las dos torres». */
export const filmNameInSaga = (name: string, base: string) => {
  const colon = name.indexOf(":");
  if (colon > 0 && name.slice(0, colon).trim().toLowerCase() === base.trim().toLowerCase()) {
    const rest = name.slice(colon + 1).trim();
    return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : name;
  }
  return name;
};

export const collectionRutaTitle = (base: string, count: number) =>
  count === 3 ? `${base}, la trilogía` : `${base}, las ${numberWord(count)}`;

const partToFilm = (part: NonNullable<TmdbCollectionPayload["parts"]>[number]): RutaFilm | null => {
  const name = part.title?.trim();
  if (!part.id || !name || part.adult) {
    return null;
  }
  const releaseDate = isoDay(part.release_date);
  return {
    tmdbId: part.id,
    name,
    originalName: part.original_title?.trim() || null,
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    releaseDate,
    posterPath: part.poster_path ?? null,
    backdropPath: part.backdrop_path ?? null,
    overview: part.overview?.trim() || null,
    voteAverage: part.vote_average ?? 0,
    voteCount: part.vote_count ?? 0,
    genreIds: part.genre_ids ?? [],
  };
};

/** Released parts of a collection in release order (announced ones are not steps yet). */
export const collectionFilms = (collection: TmdbCollectionPayload, today: string): RutaFilm[] =>
  (collection.parts ?? [])
    .flatMap((part) => {
      const film = partToFilm(part);
      return film && film.releaseDate && film.releaseDate <= today ? [film] : [];
    })
    .sort(compareRelease);

/**
 * The collection in order. The seed's step says it was yours; each other step says where it
 * picks up. Null when the collection is too short to be a ruta or every film is already seen.
 */
export const collectionRutaDraft = (
  collection: TmdbCollectionPayload,
  seed: { tmdbId: number; name: string; favorite: boolean } | null,
  seenTmdbIds: ReadonlySet<number>,
  today: string,
  /** Without a seed: what leads here («Después de El señor de los anillos.»). */
  context?: string,
): RutaDraft | null => {
  const films = collectionFilms(collection, today).slice(0, RUTA_MAX_STEPS);
  if (films.length < RUTA_MIN_STEPS || films.every((film) => seenTmdbIds.has(film.tmdbId))) {
    return null;
  }
  const base = collectionBaseName(collection.name ?? films[0]!.name);
  const total = films.length;
  const seedIndex = seed ? films.findIndex((film) => film.tmdbId === seed.tmdbId) : -1;
  const steps = films.map((film, index): RutaDraftStep => {
    const previous = films[index - 1];
    const why =
      seed && film.tmdbId === seed.tmdbId
        ? seed.favorite
          ? "Tu favorita · aquí empezó todo"
          : "La que ya viste · aquí empezó todo"
        : seenTmdbIds.has(film.tmdbId)
          ? "Ya la viste: cuenta"
          : index === 0
            ? "Donde empieza todo"
            : index === total - 1
              ? `El final, después de ${filmNameInSaga(previous!.name, base)}`
              : `Sigue justo donde te dejó ${filmNameInSaga(previous!.name, base)}`;
    const hint =
      index === total - 1
        ? `${film.year ?? "Sin fecha"} · el final`
        : `${film.year ?? "Sin fecha"} · parte ${index + 1} de ${total}`;
    return { film, why, hint };
  });
  const remaining = films.filter((film) => !seenTmdbIds.has(film.tmdbId)).length;
  const lead = !seed
    ? (context ?? `${capitalize(numberWord(total))} películas en orden.`)
    : seedIndex === 0
      ? seed.favorite
        ? "Tu favorita es la primera."
        : `Empezaste por ${seed.name}, la primera.`
      : `Ya viste ${filmNameInSaga(seed.name, base)}; esta es la saga en orden.`;
  return {
    kind: "coleccion",
    title: collectionRutaTitle(base, total),
    shortTitle: base,
    reason: `${lead} ${remaining === 1 ? "Falta una" : `Faltan ${numberWord(remaining)}`}, y se voltean al marcar la anterior.`,
    sourceKey: `coleccion:${collection.id}`,
    seedTmdbId: seed?.tmdbId ?? null,
    steps,
  };
};

// ---------------------------------------------------------------------------
// Por persona
// ---------------------------------------------------------------------------

export const PERSON_RUTA_ROLES = ["director", "fotografia", "musica", "reparto"] as const;
export type PersonRutaRole = (typeof PERSON_RUTA_ROLES)[number];

export const isPersonRutaRole = (value: unknown): value is PersonRutaRole =>
  PERSON_RUTA_ROLES.includes(value as PersonRutaRole);

const CREW_JOB: Record<Exclude<PersonRutaRole, "reparto">, string> = {
  director: "Director",
  fotografia: "Director of Photography",
  musica: "Original Music Composer",
};

/** What the person (or the duo) did on the seed: «Greig Fraser fotografió…», «Lord & Miller dirigieron…». */
const ROLE_VERB: Record<PersonRutaRole, [string, string]> = {
  director: ["dirigió", "dirigieron"],
  fotografia: ["fotografió", "fotografiaron"],
  musica: ["hizo la música de", "hicieron la música de"],
  reparto: ["sale en", "salen en"],
};

const GENRE_LABEL: Record<number, string> = {
  12: "Aventura",
  14: "Fantasía",
  16: "Animación",
  18: "Drama",
  27: "Terror",
  28: "Acción",
  35: "Comedia",
  36: "Historia",
  37: "Western",
  53: "Suspenso",
  80: "Crimen",
  878: "Ciencia ficción",
  9648: "Misterio",
  10402: "Música",
  10749: "Romance",
  10751: "Familiar",
  10752: "Bélica",
};

const SELF = /^(self|himself|herself|themselves|themself)\b/i;
const ASIDE = /\b(uncredited|archive footage|voice)\b/i;
const DOCUMENTARY = 99;

type CreditMovie = (TmdbCastCredit | TmdbCrewCredit) & { vote_average?: number };

const creditToFilm = (credit: CreditMovie): RutaFilm | null => {
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
  role: PersonRutaRole,
  today: string,
): RutaFilm[] => {
  const raw: CreditMovie[] =
    role === "reparto"
      ? (credits.cast ?? []).filter((credit) => {
          const character = credit.character?.trim() ?? "";
          return !SELF.test(character) && !ASIDE.test(character);
        })
      : (credits.crew ?? []).filter((credit) => credit.job === CREW_JOB[role]);
  const byId = new Map<number, RutaFilm>();
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

/** Two people whose work in a role is the same films (≥ 80 % both ways) are offered as one. */
export const isDuo = (a: readonly RutaFilm[], b: readonly RutaFilm[]) => {
  if (a.length === 0 || b.length === 0) {
    return false;
  }
  const ids = new Set(b.map((film) => film.tmdbId));
  const shared = a.filter((film) => ids.has(film.tmdbId)).length;
  return shared / a.length >= 0.8 && shared / b.length >= 0.8;
};

/** Ratings shrunk towards 6.5 by their vote count: a 9.0 with 60 votes does not beat a 8.4 with 20 000. */
export const bayesianRating = (film: Pick<RutaFilm, "voteAverage" | "voteCount">, prior = 6.5, weight = 500) =>
  (film.voteAverage * film.voteCount + prior * weight) / (film.voteCount + weight);

/**
 * The «esenciales»: what the person is best known for, the films the account can stream first,
 * and anything already seen always in (lo visto cuenta). Back in release order.
 */
export const pickEsenciales = (
  films: readonly RutaFilm[],
  seenTmdbIds: ReadonlySet<number>,
  onMyPlatforms: ReadonlySet<number>,
  size = ESENCIALES_SIZE,
): RutaFilm[] => {
  const seen = films.filter((film) => seenTmdbIds.has(film.tmdbId)).slice(0, Math.max(1, size - 3));
  const rest = films
    .filter((film) => !seenTmdbIds.has(film.tmdbId))
    .map((film) => ({ film, score: bayesianRating(film) + (onMyPlatforms.has(film.tmdbId) ? 0.4 : 0) }))
    .sort((a, b) => b.score - a.score || b.film.voteCount - a.film.voteCount)
    .slice(0, size - seen.length)
    .map((item) => item.film);
  return [...seen, ...rest].sort(compareRelease);
};

/** One line on why each step: the person's first, their best known, their best rated, the latest. */
const personStepWhy = (
  film: RutaFilm,
  films: readonly RutaFilm[],
  seenTmdbIds: ReadonlySet<number>,
  name: string,
) => {
  if (seenTmdbIds.has(film.tmdbId)) {
    return "Ya la viste: cuenta";
  }
  // Best known and best rated among the ones still to see: a seen film never takes the title.
  const unseen = films.filter((item) => !seenTmdbIds.has(item.tmdbId));
  const mostVoted = unseen.reduce((best, item) => (item.voteCount > best.voteCount ? item : best));
  const bestRated = unseen.reduce((best, item) => (bayesianRating(item) > bayesianRating(best) ? item : best));
  if (film === bestRated) {
    return `La mejor calificada de ${name}`;
  }
  if (film === mostVoted) {
    return `La más vista de ${name}`;
  }
  if (film === films[0]) {
    return `Donde empezó ${name}`;
  }
  if (film === films.at(-1)) {
    return `Lo más reciente de ${name}`;
  }
  const genre = film.genreIds.map((id) => GENRE_LABEL[id]).find(Boolean);
  return genre ? `${genre}, de ${film.year ?? "fecha por confirmar"}` : `De ${film.year ?? "fecha por confirmar"}`;
};

const personStepHint = (film: RutaFilm) => {
  const decade = film.year ? `De los ${Math.floor(film.year / 10) * 10}` : "Sin fecha";
  return film.voteAverage >= 7.5 ? `${decade} · de las que más gustan` : decade;
};

export type PersonRutaInput = {
  /** The person, or a duo already resolved to one name and source. */
  name: string;
  /** `persona:<id>:<role>` or `persona:<id>+<id>:<role>`. */
  sourceKey: string;
  role: PersonRutaRole;
  films: readonly RutaFilm[];
  seed: { tmdbId: number; name: string } | null;
  seenTmdbIds: ReadonlySet<number>;
  onMyPlatforms?: ReadonlySet<number>;
  /** A duo: the verbs go plural. */
  plural?: boolean;
};

/** Whole when it is short (≤ 8), «esenciales» of 6 otherwise. Null under 3 films or all seen. */
export const personRutaDraft = (input: PersonRutaInput): RutaDraft | null => {
  const total = input.films.length;
  if (total < RUTA_MIN_STEPS) {
    return null;
  }
  const whole = total <= PERSON_FULL_MAX;
  const steps = whole
    ? [...input.films]
    : pickEsenciales(input.films, input.seenTmdbIds, input.onMyPlatforms ?? new Set());
  if (steps.every((film) => input.seenTmdbIds.has(film.tmdbId))) {
    return null;
  }
  const seenCount = steps.filter((film) => input.seenTmdbIds.has(film.tmdbId)).length;
  const lead = input.seed ? `${input.name} ${ROLE_VERB[input.role][input.plural ? 1 : 0]} ${input.seed.name}.` : "";
  const tail = whole
    ? seenCount > 0
      ? ` Son ${numberWord(total)} y ya viste ${seenCount === 1 ? "una" : numberWord(seenCount)}.`
      : ` Son ${numberWord(total)}.`
    : ` ${input.plural ? "Tienen" : "Tiene"} ${total}; estas son ${numberWord(steps.length)} para empezar.`;
  return {
    kind: "persona",
    title: whole ? `${input.name}, los ${numberWord(total)}` : `${input.name}, esenciales`,
    shortTitle: input.name,
    reason: `${lead}${tail}`.trim(),
    sourceKey: input.sourceKey,
    seedTmdbId: input.seed?.tmdbId ?? null,
    steps: steps.map((film) => ({
      film,
      why: personStepWhy(film, steps, input.seenTmdbIds, input.name),
      hint: personStepHint(film),
    })),
  };
};

export const personSourceKey = (personIds: readonly number[], role: PersonRutaRole) =>
  `persona:${[...personIds].sort((a, b) => a - b).join("+")}:${role}`;

// ---------------------------------------------------------------------------
// Desde un título (FIL-I26-2)
// ---------------------------------------------------------------------------

/** «Si te gustó X»: this many films TMDB pairs with the seed, all on the account's platforms. */
export const TITLE_RUTA_SIZE = 5;
/** Known enough to recommend (same bar as the recommendation pool). */
export const TITLE_RUTA_MIN_VOTES = 100;

export const titleSourceKey = (seedTmdbId: number) => `titulo:${seedTmdbId}`;

/**
 * Five of TMDB's recommendations for a film you saw, in TMDB's order (the closest first). The
 * caller has already kept only unseen films on your platforms. Each step says what it shares
 * with the seed: a genre when there is one, else who else watched it.
 */
export const titleRutaDraft = (
  seed: { tmdbId: number; name: string; genreIds: readonly number[] },
  candidates: readonly RutaFilm[],
): RutaDraft | null => {
  const steps = candidates.slice(0, TITLE_RUTA_SIZE);
  if (steps.length < RUTA_MIN_STEPS) {
    return null;
  }
  const seedGenres = new Set(seed.genreIds);
  return {
    kind: "titulo",
    title: `Si te gustó ${seed.name}`,
    shortTitle: `Si te gustó ${seed.name}`,
    reason: `${capitalize(numberWord(steps.length))} películas que van con ${seed.name}, todas en tus plataformas.`,
    sourceKey: titleSourceKey(seed.tmdbId),
    seedTmdbId: seed.tmdbId,
    steps: steps.map((film) => {
      const shared = film.genreIds.find((id) => seedGenres.has(id) && GENRE_LABEL[id]);
      return {
        film,
        why: shared ? `${GENRE_LABEL[shared]}, como ${seed.name}` : `Quien vio ${seed.name} también vio esta`,
        hint: personStepHint(film),
      };
    }),
  };
};

export type ParsedSourceKey =
  | { kind: "coleccion"; collectionId: number }
  | { kind: "persona"; personIds: number[]; role: PersonRutaRole }
  | { kind: "titulo"; seedTmdbId: number };

export const parseSourceKey = (key: string): ParsedSourceKey | null => {
  const collection = /^coleccion:(\d+)$/.exec(key);
  if (collection) {
    return { kind: "coleccion", collectionId: Number(collection[1]) };
  }
  const title = /^titulo:(\d+)$/.exec(key);
  if (title) {
    return { kind: "titulo", seedTmdbId: Number(title[1]) };
  }
  const person = /^persona:(\d+(?:\+\d+)?):([a-z]+)$/.exec(key);
  if (person && isPersonRutaRole(person[2])) {
    return { kind: "persona", personIds: person[1]!.split("+").map(Number), role: person[2] };
  }
  return null;
};

// ---------------------------------------------------------------------------
// What is face up
// ---------------------------------------------------------------------------

export type RutaStepState = "done" | "next" | "hidden";

/**
 * Seen steps are done wherever they sit; the first unseen is `next`; everything after it is face
 * down with its hint. «Vi esto» on `next` flips the one after it.
 */
export const stepStates = (watched: readonly boolean[]): RutaStepState[] => {
  const nextIndex = watched.findIndex((done) => !done);
  return watched.map((done, index) =>
    done ? "done" : index === nextIndex ? "next" : "hidden",
  );
};

export type RutaProgress = {
  done: number;
  total: number;
  /** Index of the `next` step, null once every step is seen. */
  nextIndex: number | null;
  closed: boolean;
};

export const rutaProgress = (watched: readonly boolean[]): RutaProgress => {
  const done = watched.filter(Boolean).length;
  const nextIndex = watched.findIndex((item) => !item);
  return {
    done,
    total: watched.length,
    nextIndex: nextIndex === -1 ? null : nextIndex,
    closed: watched.length > 0 && done === watched.length,
  };
};

export const progressLabel = (progress: Pick<RutaProgress, "done" | "total">) =>
  `${progress.done} de ${progress.total}`;

export type StoredStepStamps = { position: number; revealedAt: Date | null; doneAt: Date | null };

export type StampChanges = {
  revealed: number[];
  done: number[];
  /** Stamped done before and no longer watched (Deshacer): cleared. */
  undone: number[];
  close: boolean;
};

/** What `store.syncRutas` must write so the stamps match what is watched now. */
export const stampChanges = (
  steps: readonly StoredStepStamps[],
  watched: readonly boolean[],
  closedAt: Date | null,
): StampChanges => {
  const states = stepStates(watched);
  const changes: StampChanges = { revealed: [], done: [], undone: [], close: false };
  steps.forEach((step, index) => {
    const state = states[index];
    if (state !== "hidden" && !step.revealedAt) {
      changes.revealed.push(step.position);
    }
    if (state === "done" && !step.doneAt) {
      changes.done.push(step.position);
    }
    if (state !== "done" && step.doneAt) {
      changes.undone.push(step.position);
    }
  });
  changes.close = !closedAt && rutaProgress(watched).closed;
  return changes;
};

/** Where a new ruta goes: active while there is room, waiting otherwise. */
export const statusForNewRuta = (activeCount: number): RutaStatus =>
  activeCount < MAX_ACTIVE_RUTAS ? "activa" : "espera";

// ---------------------------------------------------------------------------
// Hoy
// ---------------------------------------------------------------------------

export const RUTA_LENS_PREFIX = "ruta-";
export const TU_RUTA_NAME = "Tu ruta";

export const rutaLensSlug = (rutaId: string) => `${RUTA_LENS_PREFIX}${rutaId}`;

export const isRutaLensSlug = (slug: string) => slug.startsWith(RUTA_LENS_PREFIX);

/**
 * Ruta lenses in Hoy (428cc697): first while the account has no real recommendations (day one),
 * right after Para ti once it does. Their films leave the other lenses, so a step never shows
 * twice in the deck.
 */
export const placeRutaLenses = <L extends { slug: string; kind: string; titles: Array<{ id: string }> }>(
  lenses: readonly L[],
  rutaLenses: readonly L[],
  hasRecos: boolean,
  rutaCardIds: ReadonlySet<string>,
): L[] => {
  if (rutaLenses.length === 0) {
    return [...lenses];
  }
  const rest = lenses
    .map((lens) => ({ ...lens, titles: lens.titles.filter((title) => !rutaCardIds.has(title.id)) }))
    .filter((lens) => lens.titles.length > 0);
  const paraTi = rest.findIndex((lens) => lens.kind === "para-ti");
  if (!hasRecos || paraTi === -1) {
    return [...rutaLenses, ...rest];
  }
  return [...rest.slice(0, paraTi + 1), ...rutaLenses, ...rest.slice(paraTi + 1)];
};

// ---------------------------------------------------------------------------
// El hilo: who ties the film you just saw to the rest of what you have seen
// ---------------------------------------------------------------------------

export type ThreadPersonRole = "director" | "dp" | "composer" | "cast";

export type ThreadPerson = { id: number; name: string; role: ThreadPersonRole };

export type ThreadFilm = { catalogId: string; name: string; people: readonly ThreadPerson[] };

export type RutaThread = {
  person: ThreadPerson;
  /** Films of yours with them, the one just seen included. */
  films: string[];
  /** Also in the step that just flipped. */
  inNext: boolean;
};

const ROLE_WEIGHT: Record<ThreadPersonRole, number> = { director: 4, dp: 3, composer: 3, cast: 2 };

/**
 * The person behind the new thread: someone of the film just seen who is also in other films you
 * saw (more films first), preferring who carries on into the next step and crew over cast.
 */
export const findThread = (
  seen: ThreadFilm,
  others: readonly ThreadFilm[],
  next: ThreadFilm | null,
): RutaThread | null => {
  let best: { thread: RutaThread; score: number } | null = null;
  for (const person of seen.people) {
    const films = others.filter(
      (film) => film.catalogId !== seen.catalogId && film.people.some((other) => other.id === person.id),
    );
    const inNext = Boolean(next?.people.some((other) => other.id === person.id));
    if (films.length === 0 && !inNext) {
      continue;
    }
    const score = films.length * 10 + (inNext ? 5 : 0) + ROLE_WEIGHT[person.role];
    if (!best || score > best.score) {
      best = { thread: { person, films: [seen.name, ...films.map((film) => film.name)], inNext }, score };
    }
  }
  return best?.thread ?? null;
};

const THREAD_VERB: Record<ThreadPersonRole, string> = {
  director: "dirigió",
  dp: "fotografió",
  composer: "hizo la música de",
  cast: "sale en",
};

/** «Andrew Lesnie fotografió las dos. Con esta llevas 2 de sus 18.» */
export const threadLine = (thread: RutaThread, ofTotal: number | null) => {
  const count = thread.films.length;
  const verb = THREAD_VERB[thread.person.role];
  const what =
    count === 1 ? "esta y también la siguiente" : count === 2 ? "las dos" : `las ${numberWord(count)}`;
  const first = `${thread.person.name} ${verb} ${what}.`;
  return ofTotal && ofTotal >= count ? `${first} Con esta llevas ${count} de sus ${ofTotal}.` : first;
};

/** `Catalog.tmdbPeople` as the thread reads it: the roles above, anything else ignored. */
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
      people.push({ id, name, role: role as ThreadPersonRole });
    }
  }
  return people;
};

/** Which credit list holds a thread person's «N». */
export const personRoleOfThread = (role: ThreadPersonRole): PersonRutaRole =>
  role === "director" ? "director" : role === "dp" ? "fotografia" : role === "composer" ? "musica" : "reparto";

/** Today as an ISO day, the cut for «released». */
export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);
