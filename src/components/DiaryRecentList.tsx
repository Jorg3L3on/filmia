import Link from "next/link";
import { PersonalRating } from "@/components/PersonalRating";
import { PosterImage } from "@/components/PosterImage";
import { TagPills } from "@/components/TagPills";
import { formatWatchedDate } from "@/lib/dates";
import { SERIES_STATUS_LABEL, formatSeriesSeason } from "@/lib/labels";
import type { SeriesStatus, TitleKind } from "@/generated/prisma/client";
import { cn } from "@/lib/cn";
import { eyebrowClass, focusRing, posterFrame } from "@/lib/ui";

type DiaryTitle = {
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

type DiaryRecentListProps = {
  titles: DiaryTitle[];
  heading?: string;
};

export const DiaryRecentList = ({
  titles,
  heading = "Entradas recientes",
}: DiaryRecentListProps) => {
  if (titles.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label={heading}>
      <h2 className={eyebrowClass}>{heading}</h2>
      <ol className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
        {titles.map((title) => {
          const watchedLabel = title.watchedAt
            ? formatWatchedDate(title.watchedAt, "short")
            : null;
          const tagItems = title.tags?.map((item) => item.tag) ?? [];

          return (
            <li key={title.id} className="p-3">
              <div className="flex gap-3">
                <Link
                  href={`/titulos/${title.id}`}
                  className={cn("shrink-0", focusRing)}
                  aria-label={`${title.name}${watchedLabel ? `, vista el ${watchedLabel}` : ""}`}
                >
                  <PosterImage
                    name={title.name}
                    posterPath={title.posterPath}
                    sizes="48px"
                    className={cn(posterFrame, "w-12")}
                  />
                </Link>
                <div className="min-w-0 flex-1 space-y-1">
                  {watchedLabel ? (
                    <p className="text-[11px] uppercase tracking-wider text-accent">
                      {watchedLabel}
                    </p>
                  ) : null}
                  <h3 className="truncate font-serif text-base text-white">
                    <Link
                      href={`/titulos/${title.id}`}
                      className={`hover:text-accent ${focusRing}`}
                    >
                      {title.name}
                    </Link>
                    {title.year ? (
                      <span className="font-sans text-xs text-mist">
                        {" "}
                        · {title.year}
                      </span>
                    ) : null}
                  </h3>
                  <PersonalRating rating={title.rating} size="sm" />
                  {title.kind === "SERIES" && title.seriesStatus ? (
                    <p className="text-[11px] uppercase tracking-wider text-mist">
                      {SERIES_STATUS_LABEL[title.seriesStatus]}
                      {formatSeriesSeason(title.seriesSeason)
                        ? ` · ${formatSeriesSeason(title.seriesSeason)}`
                        : ""}
                    </p>
                  ) : null}
                  {title.review ? (
                    <p className="line-clamp-2 text-xs text-fog">{title.review}</p>
                  ) : null}
                  <TagPills tags={tagItems} compact />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
