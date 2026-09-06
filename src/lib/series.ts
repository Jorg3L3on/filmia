import { type SeriesStatus, type TitleKind } from "@/db";
import { SERIES_STATUS_LABEL, SERIES_STATUSES } from "@/lib/labels";

export type SeriesStatusFilter = SeriesStatus | "NONE";

export const SERIES_STATUS_FILTER_OPTIONS = [
  ...SERIES_STATUSES.map((id) => ({ id, label: SERIES_STATUS_LABEL[id] })),
  { id: "NONE" as const, label: "Sin estado" },
] as const satisfies ReadonlyArray<{ id: SeriesStatusFilter; label: string }>;

export const isSeriesStatusFilter = (
  value: string | undefined | null,
): value is SeriesStatusFilter =>
  value === "NONE" || SERIES_STATUSES.includes(value as SeriesStatus);

export const parseSeriesStatusFilter = (value: unknown): SeriesStatusFilter | undefined => {
  if (Array.isArray(value)) {
    const last = value.at(-1);
    return parseSeriesStatusFilter(last);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return isSeriesStatusFilter(normalized) ? normalized : undefined;
};

export const titleMatchesSeriesStatus = (
  title: { kind: TitleKind; seriesStatus: SeriesStatus | null },
  filter: SeriesStatusFilter | undefined,
) => {
  if (!filter) {
    return true;
  }

  if (title.kind !== "SERIES") {
    return false;
  }

  if (filter === "NONE") {
    return title.seriesStatus == null;
  }

  return title.seriesStatus === filter;
};
