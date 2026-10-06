import type { Platform, TitleKind } from "@/db";
import { PLATFORMS } from "@/lib/labels";
import type { SeriesStatusFilter } from "@/lib/series";

const uniquePlatforms = (values: Platform[]) =>
  PLATFORMS.filter((platform) => values.includes(platform));

export const MINE_PLATFORMS_PARAM = "minePlatforms";

const uniqueSlugs = (values: string[]) => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

export type CatalogKindFilter = TitleKind | "ALL";

export type CatalogQuery = {
  tags?: string[];
  view?: string | null;
  sort?: string | null;
  minePlatforms?: boolean;
  seriesStatus?: SeriesStatusFilter | null;
  month?: string | null;
  day?: string | null;
  defaultView?: string | null;
  mode?: string | null;
  kind?: CatalogKindFilter | null;
  platforms?: Platform[];
  /** Quiero ver rail: fits before bedtime (client-side filter). */
  tonight?: boolean;
  /** Quiero ver rail: movies under 100 min. */
  short?: boolean;
  /** Quiero ver rail: has an awards chip. */
  awarded?: boolean;
  /** Quiero ver rail: TMDB genre ids. */
  genres?: number[];
};

export const TONIGHT_PARAM = "tonight";
export const SHORT_PARAM = "short";
export const AWARDED_PARAM = "awarded";
export const GENRE_PARAM = "genre";

const uniqueGenreIds = (values: number[]) => [
  ...new Set(values.filter((id) => Number.isInteger(id) && id > 0)),
];

export const catalogSearchParams = ({
  tags = [],
  view,
  sort,
  minePlatforms,
  seriesStatus,
  month,
  day,
  defaultView = "deck",
  mode,
  kind,
  platforms = [],
  tonight,
  short,
  awarded,
  genres = [],
}: CatalogQuery) => {
  const params = new URLSearchParams();

  for (const slug of uniqueSlugs(tags)) {
    params.append("tag", slug);
  }

  if (view && view !== defaultView) {
    params.set("view", view);
  }

  if (sort) {
    params.set("sort", sort);
  }

  if (minePlatforms) {
    params.set(MINE_PLATFORMS_PARAM, "1");
  }

  if (seriesStatus) {
    params.set("seriesStatus", seriesStatus);
  }

  if (month) {
    params.set("month", month);
  }

  const isCalendar = view === "calendar" || (!view && defaultView === "calendar");
  if (day && isCalendar) {
    params.set("day", day);
  }

  if (mode && mode !== "picks") {
    params.set("mode", mode);
  }

  if (kind && kind !== "ALL") {
    params.set("kind", kind);
  }

  for (const platform of uniquePlatforms(platforms)) {
    params.append("platform", platform);
  }

  // Quiero ver rail params go last so the older exact-href checks keep their shape.
  if (tonight) {
    params.set(TONIGHT_PARAM, "1");
  }
  if (short) {
    params.set(SHORT_PARAM, "1");
  }
  if (awarded) {
    params.set(AWARDED_PARAM, "1");
  }
  for (const id of uniqueGenreIds(genres)) {
    params.append(GENRE_PARAM, String(id));
  }

  return params;
};

export const catalogHref = (pathname: string, query: CatalogQuery = {}) => {
  const qs = catalogSearchParams(query).toString();
  return qs ? `${pathname}?${qs}` : pathname;
};
