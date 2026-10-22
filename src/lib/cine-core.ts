/**
 * Cine (FIL-I17): the pure half — which TMDB films count as an MX theatrical release, the
 * status a release has on a given day, and the calendar helpers the pages share. No DB, no
 * fetch: the cron (`cine-store.ts`) and the pages call into this.
 */

export type CinemaReleaseStatus = "now" | "upcoming" | "gone";
export type CinemaReleaseSource = "tmdb" | "imcine";

export const CINE_TIME_ZONE = "America/Mexico_City";

/** TMDB `release_dates` types: 1 premiere (festival), 2 limited, 3 theatrical, 4 digital… */
export const RELEASE_TYPE_PREMIERE = 1;
export const RELEASE_TYPE_LIMITED = 2;
export const RELEASE_TYPE_THEATRICAL = 3;

/** Below this TMDB popularity a film is noise — unless it is Spanish-language or Mexican. */
export const MIN_POPULARITY = 5;
/** A commercial MX date this long after the original release is a re-release. */
export const RERELEASE_GAP_DAYS = 365;
/** Shorts (FICM online, Nuestro Cine MX) are not cartelera. Unknown runtime (0/null) passes. */
export const MIN_FEATURE_MINUTES = 40;
/** A row the TMDB lists stop returning for this long turns `gone`. */
export const GONE_AFTER_DAYS = 3;
/** «Estreno» tag on a poster for its first week in theaters. */
export const PREMIERE_TAG_DAYS = 7;
/** «Ya en casa»: a film counts as having left theaters this long after its MX release. */
export const HOME_AFTER_DAYS = 42;
/** «Ya en casa» looks back this far for films that were in theaters. */
export const HOME_LOOKBACK_DAYS = 183;

const DAY_MS = 24 * 60 * 60 * 1000;

export type TmdbReleaseDate = {
  type: number;
  release_date: string;
  note?: string;
  iso_639_1?: string;
  certification?: string;
};

/** What the filter reads from `/movie/{id}?append_to_response=release_dates`. */
export type CinemaCandidate = {
  tmdbId: number;
  popularity: number;
  originalLanguage: string | null;
  productionCountries: string[];
  /** Primary (worldwide) release date, `YYYY-MM-DD`. */
  releaseDate: string | null;
  runtimeMinutes?: number | null;
  /** The `MX` entry of `release_dates.results`. */
  mxReleaseDates: TmdbReleaseDate[];
};

export type CinemaVerdict =
  | { ok: true; mxReleaseDate: string }
  | { ok: false; reason: "no_theatrical" | "rerelease" | "unpopular" | "short" };

const dayOf = (value: string) => value.slice(0, 10);

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${dayOf(to)}T00:00:00Z`) - Date.parse(`${dayOf(from)}T00:00:00Z`)) / DAY_MS);

export const isMexicanOrSpanish = (candidate: Pick<CinemaCandidate, "originalLanguage" | "productionCountries">) =>
  candidate.originalLanguage === "es" || candidate.productionCountries.includes("MX");

/**
 * The commercial MX date of a film, or why it does not count. Festival dates (type 1) are
 * ignored without discarding the film (Wildwood: Morelia first, theaters a week later); a film
 * with only limited dates (type 2) is out. With several type-3 dates the latest wins, so an old
 * film's re-release is judged by its new date and then caught as a re-release.
 */
export const judgeCinemaCandidate = (candidate: CinemaCandidate): CinemaVerdict => {
  const theatrical = candidate.mxReleaseDates
    .filter((entry) => entry.type === RELEASE_TYPE_THEATRICAL && entry.release_date)
    .map((entry) => dayOf(entry.release_date))
    .sort();
  const mxReleaseDate = theatrical.at(-1);
  if (!mxReleaseDate) {
    return { ok: false, reason: "no_theatrical" };
  }

  if (candidate.releaseDate && daysBetween(candidate.releaseDate, mxReleaseDate) > RERELEASE_GAP_DAYS) {
    return { ok: false, reason: "rerelease" };
  }

  if (candidate.runtimeMinutes && candidate.runtimeMinutes < MIN_FEATURE_MINUTES) {
    return { ok: false, reason: "short" };
  }

  if (candidate.popularity < MIN_POPULARITY && !isMexicanOrSpanish(candidate)) {
    return { ok: false, reason: "unpopular" };
  }

  return { ok: true, mxReleaseDate };
};

/** Today's calendar day in Mexico City, `YYYY-MM-DD`. */
export const mxToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: CINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${dayOf(day)}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export const releaseStatusOn = (mxReleaseDate: string, today: string): "now" | "upcoming" =>
  dayOf(mxReleaseDate) <= today ? "now" : "upcoming";

export type StoredRelease = { mxReleaseDate: string; source: CinemaReleaseSource; popularity: number };

/**
 * What a release row becomes when a source reports it: an IMCINE date always wins and TMDB never
 * replaces it (TMDB still refreshes the popularity); the status follows the resulting date.
 */
export const mergeRelease = (
  existing: StoredRelease | null,
  incoming: StoredRelease,
  today: string,
): StoredRelease & { status: "now" | "upcoming" } => {
  const keepImcine = existing?.source === "imcine" && incoming.source === "tmdb";
  const merged: StoredRelease = keepImcine
    ? { mxReleaseDate: existing.mxReleaseDate, source: "imcine", popularity: incoming.popularity }
    : {
        mxReleaseDate: incoming.mxReleaseDate,
        source: incoming.source,
        popularity: incoming.source === "imcine" ? Math.max(existing?.popularity ?? 0, incoming.popularity) : incoming.popularity,
      };
  return { ...merged, status: releaseStatusOn(merged.mxReleaseDate, today) };
};

export const isGone = (lastSeenAt: Date, now = new Date()) =>
  now.getTime() - lastSeenAt.getTime() >= GONE_AFTER_DAYS * DAY_MS;

export const isPremiereWeek = (mxReleaseDate: string, today: string) => {
  const age = daysBetween(mxReleaseDate, today);
  return age >= 0 && age < PREMIERE_TAG_DAYS;
};

/** «Estreno» stays on a poster this many days after its premiere day («Hoy»). */
export const PREMIERE_RECENT_DAYS = 3;

/** Poster tag (FIL-I23-4, P3): «Hoy» on the premiere day, «Estreno» up to three days after, else none. */
export const premiereTag = (mxReleaseDate: string, today: string): "Hoy" | "Estreno" | null => {
  const age = daysBetween(mxReleaseDate, today);
  if (age === 0) {
    return "Hoy";
  }
  return age > 0 && age <= PREMIERE_RECENT_DAYS ? "Estreno" : null;
};

/** Which edges of a horizontal rail hide more content: "", "left", "right" or "left right". */
export const railFade = (scrollLeft: number, clientWidth: number, scrollWidth: number) =>
  [scrollLeft > 1 ? "left" : null, scrollLeft + clientWidth < scrollWidth - 1 ? "right" : null].filter(Boolean).join(" ");

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const WEEKDAYS_SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

const parts = (day: string) => {
  const date = new Date(`${dayOf(day)}T12:00:00Z`);
  return { date, month: date.getUTCMonth(), dayOfMonth: date.getUTCDate(), weekday: date.getUTCDay() };
};

/** «6 nov» */
export const formatShortDay = (day: string) => {
  const { dayOfMonth, month } = parts(day);
  return `${dayOfMonth} ${MONTHS_SHORT[month]}`;
};

/** Ticket stub: `{ weekday: "JUE", day: 22 }`. */
export const ticketStub = (day: string) => {
  const { weekday, dayOfMonth } = parts(day);
  return { weekday: WEEKDAYS_SHORT[weekday] ?? "", day: dayOfMonth };
};

export const monthName = (day: string) => MONTHS_LONG[parts(day).month] ?? "";

/** Monday of the week a day falls in (MX weeks start on Monday; premieres land on Thursday). */
export const weekStart = (day: string) => {
  const { weekday } = parts(day);
  return addDays(day, -((weekday + 6) % 7));
};

export type WeekGroup<T> = { week: string; month: string; items: T[] };

/** Releases grouped by week (ascending), each week carrying the month of its first release. */
export const groupByWeek = <T extends { mxReleaseDate: string }>(items: readonly T[]): WeekGroup<T>[] => {
  const groups = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => a.mxReleaseDate.localeCompare(b.mxReleaseDate))) {
    const week = weekStart(item.mxReleaseDate);
    const bucket = groups.get(week) ?? [];
    bucket.push(item);
    groups.set(week, bucket);
  }
  return [...groups.entries()].map(([week, bucket]) => ({
    week,
    month: monthName(bucket[0]?.mxReleaseDate ?? week),
    items: bucket,
  }));
};

/** End of the Próximamente timeline: December 31 of the current MX year. */
export const upcomingHorizon = (today: string) => `${today.slice(0, 4)}-12-31`;

/** «Actualizado hace 3 h» from the newest lastSeenAt; null when it is fresh (under 26 h). */
export const staleLabel = (lastRunAt: Date | null, now = new Date()) => {
  if (!lastRunAt) {
    return null;
  }
  const hours = Math.floor((now.getTime() - lastRunAt.getTime()) / (60 * 60 * 1000));
  if (hours < 26) {
    return null;
  }
  return hours < 48 ? `Actualizado hace ${hours} h` : `Actualizado hace ${Math.floor(hours / 24)} días`;
};

/**
 * The ficha's theater chip (FIL-I23-3) and badge share one rule: shown while Cine knows the film
 * is in theaters or coming, hidden once it streams flatrate in MX (the theaters are old news).
 */
export const cinemaChipFor = <T extends { status: "now" | "upcoming"; mxReleaseDate: string }>(
  cinema: T | null,
  flatrateCount: number,
): T | null => (cinema && flatrateCount === 0 ? cinema : null);

/** Thursday that opened the premiere week `today` falls in (MX premieres land on Thursday). */
export const premiereWeekStart = (today: string) => {
  const { weekday } = parts(today);
  return addDays(today, -((weekday + 3) % 7));
};

export type CarteleraOrder = "recientes" | "populares";

export const parseCarteleraOrder = (value: unknown): CarteleraOrder => {
  const raw = Array.isArray(value) ? value.at(-1) : value;
  return raw === "populares" ? "populares" : "recientes";
};

/**
 * Cartelera B (FIL-I23-5): «Esta semana» holds the films that opened in the premiere week in
 * progress (Thursday to Wednesday); «Siguen en cartelera» the rest, by date or by popularity.
 */
export const splitCartelera = <T extends { mxReleaseDate: string; popularity: number }>(
  films: readonly T[],
  today: string,
  order: CarteleraOrder = "recientes",
) => {
  const weekStart = premiereWeekStart(today);
  const weekEnd = addDays(weekStart, 6);
  const thisWeek = films.filter((film) => film.mxReleaseDate >= weekStart && film.mxReleaseDate <= weekEnd);
  const rest = films.filter((film) => film.mxReleaseDate < weekStart || film.mxReleaseDate > weekEnd);
  const sorted =
    order === "populares"
      ? [...rest].sort((a, b) => b.popularity - a.popularity || b.mxReleaseDate.localeCompare(a.mxReleaseDate))
      : [...rest].sort((a, b) => b.mxReleaseDate.localeCompare(a.mxReleaseDate) || b.popularity - a.popularity);
  return { weekStart, thisWeek, rest: sorted };
};
