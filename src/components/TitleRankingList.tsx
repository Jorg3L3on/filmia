import Link from "next/link";
import type { CSSProperties } from "react";
import { PersonalRating } from "@/components/PersonalRating";
import { SharedPoster } from "@/components/SharedPoster";
import { PosterImage } from "@/components/PosterImage";
import { TagPills } from "@/components/TagPills";
import { formatWatchedDate } from "@/lib/dates";
import { SERIES_STATUS_LABEL, formatSeriesSeason } from "@/lib/labels";
import type { SeriesStatus, TitleKind } from "@/db";
import { cn } from "@/lib/cn";
import { eyebrowClass, focusRing, posterFrame } from "@/lib/ui";

type RankingTitle = {
  id: string;
  name: string;
  year: number | null;
  rating: number | null;
  watchedAt: Date | null;
  posterPath: string | null;
  kind?: TitleKind;
  seriesStatus?: SeriesStatus | null;
  seriesSeason?: number | null;
  tags: Array<{ tag: { id: string; name: string; slug: string } }>;
};

type TitleRankingListProps = {
  titles: RankingTitle[];
};

const rankingStagger = (index: number): CSSProperties =>
  ({
    "--stagger": index,
    "--stagger-step": "40ms",
  }) as CSSProperties;

export const TitleRankingList = ({ titles }: TitleRankingListProps) => {
  if (titles.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label="Ranking dentro de la etiqueta">
      <h2 className={eyebrowClass}>Ranking</h2>
      <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {titles.map((title, index) => {
          const watchedLabel = title.watchedAt
            ? formatWatchedDate(title.watchedAt, "short")
            : null;

          return (
            <li
              key={title.id}
              className="stagger-in"
              style={rankingStagger(index)}
            >
              <div
                className={cn(
                  "group flex gap-3 p-3 transition-colors duration-[var(--duration-hover)]",
                  "hover:bg-well/70",
                )}
              >
                <p
                  className="w-8 shrink-0 pt-6 text-center font-serif text-lg font-semibold tabular-nums text-accent"
                  aria-label={`Puesto ${index + 1}`}
                >
                  {index + 1}
                </p>
                <Link
                  href={`/titulos/${title.id}`}
                  className={cn(
                    "press-scale shrink-0 transition-[transform,filter] duration-[var(--duration-hover)]",
                    focusRing,
                  )}
                  aria-label={title.name}
                >
                  <SharedPoster titleId={title.id}>
                    <PosterImage
                      name={title.name}
                      posterPath={title.posterPath}
                      sizes="48px"
                      className={cn(
                        posterFrame,
                        "w-12 transition-[filter] duration-[var(--duration-hover)] group-hover:brightness-110",
                      )}
                    />
                  </SharedPoster>
                </Link>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Link
                    href={`/titulos/${title.id}`}
                    className={cn("press-scale block", focusRing)}
                  >
                    <h3 className="truncate font-serif text-base text-paper transition-colors duration-[var(--duration-hover)] group-hover:text-accent hover:text-accent">
                      {title.name}
                      {title.year ? (
                        <span className="font-sans text-xs text-mist">
                          {" "}
                          · {title.year}
                        </span>
                      ) : null}
                    </h3>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    <PersonalRating rating={title.rating} size="sm" />
                    {watchedLabel ? (
                      <p className="text-[11px] uppercase tracking-wider text-mist">
                        {watchedLabel}
                      </p>
                    ) : (
                      <p className="text-[11px] uppercase tracking-wider text-mist">
                        Sin ver
                      </p>
                    )}
                    {title.kind === "SERIES" && title.seriesStatus ? (
                      <p className="text-[11px] uppercase tracking-wider text-mist">
                        {SERIES_STATUS_LABEL[title.seriesStatus]}
                        {formatSeriesSeason(title.seriesSeason)
                          ? ` · ${formatSeriesSeason(title.seriesSeason)}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <TagPills
                    tags={title.tags.map((item) => item.tag)}
                    compact
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
