import type { SeriesStatus, TitleKind } from "@/generated/prisma/browser";

export type DiaryCalendarTitle = {
  id: string;
  name: string;
  year: number | null;
  rating: number | null;
  review: string | null;
  watchedAt: Date | null;
  posterPath: string | null;
  kind?: TitleKind;
  seriesStatus?: SeriesStatus | null;
  seriesSeason?: number | null;
  tags?: Array<{ tag: { id: string; name: string; slug: string } }>;
};
