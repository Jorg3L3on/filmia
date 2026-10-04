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
};

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

  return params;
};

export const catalogHref = (pathname: string, query: CatalogQuery = {}) => {
  const qs = catalogSearchParams(query).toString();
  return qs ? `${pathname}?${qs}` : pathname;
};
