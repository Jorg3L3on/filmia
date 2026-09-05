import Link from "next/link";
import { MarkSeenEye } from "@/components/MarkSeenEye";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { TagPills } from "@/components/TagPills";
import { WatchedBadge } from "@/components/WatchedBadge";
import { SeriesStatusBadge } from "@/components/SeriesStatusBadge";
import { cn } from "@/lib/cn";
import { formatRating } from "@/lib/labels";
import { PICKS_SAVE_LABEL } from "@/lib/mark-seen";
import { focusRing, posterFrame } from "@/lib/ui";
import type { SeriesStatus } from "@/generated/prisma/browser";

type PosterTileProps = {
  titleId?: string;
  href: string;
  name: string;
  posterPath?: string | null;
  year?: number | null;
  rating?: number | null;
  review?: string | null;
  watchedAt?: Date | null;
  seriesStatus?: SeriesStatus | null;
  caption?: string;
  className?: string;
  sizes?: string;
  tags?: Array<{ id: string; name: string; slug: string }>;
  showMarkSeenEye?: boolean;
};

export const PosterTile = ({
  titleId,
  href,
  name,
  posterPath,
  year,
  rating,
  review = null,
  watchedAt,
  seriesStatus,
  caption,
  className,
  sizes,
  tags = [],
  showMarkSeenEye = false,
}: PosterTileProps) => {
  const watched = Boolean(watchedAt);
  const canMarkSeen = showMarkSeenEye && Boolean(titleId) && !watched;
  const meta = [year, rating != null ? formatRating(rating) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={cn("min-w-0", className)}>
      <div className="relative card-physics press-scale">
        <Link
          href={href}
          aria-label={`${name}${year ? ` (${year})` : ""}${watched ? ", visto" : ""}`}
          className={cn("block", focusRing)}
        >
          {titleId ? (
            <SharedPoster titleId={titleId}>
              <PosterImage
                name={name}
                posterPath={posterPath}
                sizes={sizes}
                className={posterFrame}
              />
            </SharedPoster>
          ) : (
            <PosterImage
              name={name}
              posterPath={posterPath}
              sizes={sizes}
              className={posterFrame}
            />
          )}
          {watched ? (
            <WatchedBadge compact className="absolute left-2 top-2" />
          ) : null}
          {seriesStatus && !canMarkSeen ? (
            <SeriesStatusBadge
              status={seriesStatus}
              compact
              className="absolute right-2 top-2"
            />
          ) : null}
        </Link>
        {canMarkSeen && titleId ? (
          <MarkSeenEye
            titleId={titleId}
            titleName={name}
            rating={rating}
            review={review}
            size="hero"
            saveLabel={PICKS_SAVE_LABEL}
          />
        ) : null}
      </div>
      <Link href={href} tabIndex={-1} className="group block" aria-hidden="true">
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
