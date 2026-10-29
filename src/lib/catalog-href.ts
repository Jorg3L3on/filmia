import type { Platform, TitleKind } from "@/db";
import { PLATFORMS } from "@/lib/labels";
import type { SeriesStatusFilter } from "@/lib/series";

const uniquePlatforms = (values: Platform[]) =>
  PLATFORMS.filter((platform) => values.includes(platform));

export const MINE_PLATFORMS_PARAM = "minePlatforms";

export type CatalogKindFilter = TitleKind | "ALL";

export type CatalogSort = "recent" | "watched" | "rating" | "name" | "year";

/**
 * `?minePlatforms=1` (también `true` / `on`) activa “Solo en mis plataformas”.
 */
export const parseMinePlatforms = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => parseMinePlatforms(item));
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
};

export type CatalogQuery = {
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
};

/*
 * Quiero ver has its own params (scope, order with direction, the Filtros sheet): they are
 * documented and built in `watchlist-query.ts` (`watchlistHref`). `?tonight=` is gone (FIL-I34-1).
 */

export const catalogSearchParams = ({
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
}: CatalogQuery) => {
  const params = new URLSearchParams();

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

  return params;
};

export const catalogHref = (pathname: string, query: CatalogQuery = {}) => {
  const qs = catalogSearchParams(query).toString();
  return qs ? `${pathname}?${qs}` : pathname;
};
