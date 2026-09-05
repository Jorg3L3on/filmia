import Link from "next/link";
import { PosterImage } from "@/components/PosterImage";
import { TagPills } from "@/components/TagPills";
import { WatchedBadge } from "@/components/WatchedBadge";
import { SeriesStatusBadge } from "@/components/SeriesStatusBadge";
import { cn } from "@/lib/cn";
import { formatRating } from "@/lib/labels";
import { focusRing, posterFrame } from "@/lib/ui";
import type { SeriesStatus } from "@/db";

type PosterTileProps = {
  href: string;
  name: string;
  posterPath?: string | null;
  year?: number | null;
  rating?: number | null;
  watchedAt?: Date | null;
  seriesStatus?: SeriesStatus | null;
  caption?: string;
  className?: string;
  sizes?: string;
  tags?: Array<{ id: string; name: string; slug: string }>;
};

export const PosterTile = ({
  href,
  name,
  posterPath,
  year,
  rating,
  watchedAt,
  seriesStatus,
  caption,
  className,
  sizes,
  tags = [],
}: PosterTileProps) => {
  const watched = Boolean(watchedAt);
  const meta = [year, rating != null ? formatRating(rating) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={cn("min-w-0", className)}>
      <Link
        href={href}
        aria-label={`${name}${year ? ` (${year})` : ""}${watched ? ", visto" : ""}`}
        className={cn("group block", focusRing)}
      >
        <div className="relative">
          <PosterImage
            name={name}
            posterPath={posterPath}
            sizes={sizes}
            className={cn(
              posterFrame,
              "transition duration-200 group-hover:brightness-110",
            )}
          />
          {watched ? (
            <WatchedBadge compact className="absolute left-2 top-2" />
          ) : null}
          {seriesStatus ? (
            <SeriesStatusBadge
              status={seriesStatus}
              compact
              className="absolute right-2 top-2"
            />
          ) : null}
        </div>
        <h2 className="mt-2 truncate font-serif text-sm leading-tight text-white group-hover:text-accent">
          {name}
        </h2>
        {caption || meta ? (
          <p className="truncate text-[11px] text-mist">{caption ?? meta}</p>
        ) : null}
      </Link>
      {tags.length > 0 ? (
        <div className="mt-1.5">
          <TagPills tags={tags} compact />
        </div>
      ) : null}
    </article>
  );
};
