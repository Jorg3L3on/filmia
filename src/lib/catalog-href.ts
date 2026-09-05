import type { SeriesStatusFilter } from "@/lib/series";

export const MINE_PLATFORMS_PARAM = "minePlatforms";

const uniqueSlugs = (values: string[]) => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

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

  if (day) {
    params.set("day", day);
  }

  if (mode && mode !== "picks") {
    params.set("mode", mode);
  }

  return params;
};

export const catalogHref = (pathname: string, query: CatalogQuery = {}) => {
  const qs = catalogSearchParams(query).toString();
  return qs ? `${pathname}?${qs}` : pathname;
};
