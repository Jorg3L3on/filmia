import Link from "next/link";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { formatRating } from "@/lib/labels";
import { focusRing, posterFrame } from "@/lib/ui";

type PosterTileProps = {
  href: string;
  name: string;
  posterPath?: string | null;
  year?: number | null;
  rating?: number | null;
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
  caption,
  className,
  sizes,
}: PosterTileProps) => {
  const meta = [year, rating != null ? formatRating(rating) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={cn("min-w-0", className)}>
      <Link
        href={href}
        aria-label={`${name}${year ? ` (${year})` : ""}`}
        className={cn("group block", focusRing)}
      >
        <PosterImage
          name={name}
          posterPath={posterPath}
          sizes={sizes}
          className={cn(
            posterFrame,
            "transition duration-200 group-hover:brightness-110",
          )}
        />
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
