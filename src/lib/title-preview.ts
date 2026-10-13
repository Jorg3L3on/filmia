import type { TitleKind } from "@/db";
import { isoDateToUtcNoon, monthFromIsoDate, parseOptionalIsoDate, WEEKDAY_LABELS_SHORT } from "@/lib/dates";

/**
 * Ficha preview (FIL-I8): a film you do not have yet, addressed by TMDB.
 * `/titulos/tmdb/pelicula/123` — the Spanish kind slug Buscar already uses
 * in `?tipo=`, so the URL reads like the rest of Filmia.
 */
const KIND_SLUG: Record<TitleKind, string> = { MOVIE: "pelicula", SERIES: "serie" };

export const kindFromSlug = (slug: string): TitleKind | null =>
  slug === KIND_SLUG.MOVIE ? "MOVIE" : slug === KIND_SLUG.SERIES ? "SERIES" : null;

/** A positive integer TMDB id from the path, or null («12abc», «0», «-3» are not ids). */
export const parseTmdbIdParam = (raw: string): number | null => {
  if (!/^\d{1,10}$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

/**
 * Diario mode: Buscar opened from the calendar logs a viewing on that day. The
 * ficha carries the day so its primary action becomes «Registrar vista · fecha».
 */
export type DiaryLog = {
  /** The calendar day; null = «destino=visto» without a day, which logs today. */
  date: string | null;
};

/** Same rule as Buscar: a valid `fecha` or `destino=visto` means Diario mode. */
export const parseDiaryLog = (params: {
  fecha?: string | string[];
  destino?: string | string[];
}): DiaryLog | null => {
  const date = parseOptionalIsoDate(params.fecha);
  if (date) {
    return { date };
  }
  return params.destino === "visto" ? { date: null } : null;
};

const diaryQuery = (log: DiaryLog | null | undefined) => {
  if (!log) {
    return "";
  }
  const query = new URLSearchParams();
  if (log.date) {
    query.set("fecha", log.date);
  }
  query.set("destino", "visto");
  return `?${query}`;
};

export const previewFichaHref = (
  kind: TitleKind,
  tmdbId: number,
  log?: DiaryLog | null,
) => `/titulos/tmdb/${KIND_SLUG[kind]}/${tmdbId}${diaryQuery(log)}`;

/** The user's own ficha, keeping Diario mode when Buscar was logging a day. */
export const ownedFichaHref = (titleId: string, log?: DiaryLog | null) =>
  `/titulos/${titleId}${diaryQuery(log)}`;

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** «dom 12 oct» — the day on the Diario button and chip; «hoy» without a day. */
export const diaryDayLabel = (isoDate: string | null) => {
  if (!isoDate) {
    return "hoy";
  }
  const date = isoDateToUtcNoon(isoDate);
  const weekday = WEEKDAY_LABELS_SHORT[(date.getUTCDay() + 6) % 7];
  return `${weekday} ${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`;
};

/** Back to the calendar month the viewing was logged in. */
export const diaryMonthHref = (isoDate: string | null) =>
  isoDate ? `/diario?month=${monthFromIsoDate(isoDate)}` : "/diario";

type EnrichmentState = {
  imdbId?: string | null;
  runtimeMinutes?: number | null;
  tmdbGenres?: unknown;
  overview?: string | null;
};

/**
 * A catalog row only the search snapshot filled (Buscar's old sheet, a lazy
 * search fill): no imdbId, runtime or genres yet. The preview then resolves
 * TMDB + OMDb while it streams and enriches the shared row after the response.
 */
export const catalogNeedsEnrichment = (row: EnrichmentState) => {
  const genres = Array.isArray(row.tmdbGenres) ? row.tmdbGenres : [];
  return !row.imdbId && (row.runtimeMinutes == null || genres.length === 0);
};
