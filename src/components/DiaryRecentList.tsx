import Link from "next/link";
import { PersonalRating } from "@/components/PersonalRating";
import { PosterImage } from "@/components/PosterImage";
import { formatWatchedDate } from "@/lib/dates";
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
};

type DiaryRecentListProps = {
  titles: DiaryTitle[];
};

export const DiaryRecentList = ({ titles }: DiaryRecentListProps) => {
  if (titles.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label="Entradas recientes del diario">
      <h2 className={eyebrowClass}>Entradas recientes</h2>
      <ol className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
        {titles.map((title) => {
          const watchedLabel = title.watchedAt
            ? formatWatchedDate(title.watchedAt, "short")
            : null;

          return (
            <li key={title.id}>
              <Link
                href={`/titulos/${title.id}`}
                className={cn(
                  "flex gap-3 p-3 transition hover:bg-well",
                  focusRing,
                )}
                aria-label={`${title.name}${watchedLabel ? `, vista el ${watchedLabel}` : ""}`}
              >
                <PosterImage
                  name={title.name}
                  posterPath={title.posterPath}
                  sizes="48px"
                  className={cn(posterFrame, "w-12 shrink-0")}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  {watchedLabel ? (
                    <p className="text-[11px] uppercase tracking-wider text-accent">
                      {watchedLabel}
                    </p>
                  ) : null}
                  <h3 className="truncate font-serif text-base text-white">
                    {title.name}
                    {title.year ? (
                      <span className="font-sans text-xs text-mist">
                        {" "}
                        · {title.year}
                      </span>
                    ) : null}
                  </h3>
                  <PersonalRating rating={title.rating} size="sm" />
                  {title.review ? (
                    <p className="line-clamp-2 text-xs text-fog">{title.review}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
