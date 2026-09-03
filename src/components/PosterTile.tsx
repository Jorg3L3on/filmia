import Link from "next/link";
import { PosterImage } from "@/components/PosterImage";
import { WatchedBadge } from "@/components/WatchedBadge";
import { cn } from "@/lib/cn";
import { formatRating } from "@/lib/labels";
import { focusRing, posterFrame } from "@/lib/ui";

type PosterTileProps = {
  href: string;
  name: string;
  posterPath?: string | null;
  year?: number | null;
  rating?: number | null;
  watchedAt?: Date | null;
  caption?: string;
  className?: string;
  sizes?: string;
};

export const PosterTile = ({
  href,
  name,
  posterPath,
  year,
  rating,
  watchedAt,
  caption,
  className,
  sizes,
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
        </div>
        <h2 className="mt-2 truncate font-serif text-sm leading-tight text-white group-hover:text-accent">
          {name}
        </h2>
        {caption || meta ? (
          <p className="truncate text-[11px] text-mist">{caption ?? meta}</p>
        ) : null}
      </Link>
    </article>
  );
};
