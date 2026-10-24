import { PosterImageFallback } from "@/components/PosterImageFallback";
import { PosterPlaceholder } from "@/components/PosterPlaceholder";
import { cn } from "@/lib/cn";
import { tmdbPosterUrl } from "@/lib/tmdb";

const TMDB_SIZED = /^https:\/\/image\.tmdb\.org\/t\/p\/w\d+\//;

type PosterImageProps = {
  name: string;
  posterPath?: string | null;
  className?: string;
  priority?: boolean;
  fetchPriority?: "high" | "low" | "auto";
  sizes?: string;
  ratio?: "poster" | "fill";
  // TMDB file size: w185 for thumbnails up to 56px, w500 for the ficha poster.
  tmdbSize?: "w185" | "w342" | "w500";
  /**
   * A srcset of TMDB sizes (w185…w780) picked by `sizes` and the screen's density, still without
   * Vercel's optimizer. For big posters (the Hoy deck): one w342 drawn at 215 px on a 2–3× screen is soft.
   */
  responsive?: boolean;
};

export const PosterImage = ({
  name,
  posterPath,
  className,
  priority = false,
  fetchPriority,
  sizes = "(max-width: 768px) 50vw, 220px",
  ratio = "poster",
  tmdbSize = "w342",
  responsive = false,
}: PosterImageProps) => {
  const src = tmdbPosterUrl(posterPath, tmdbSize);

  if (!src) {
    return (
      <PosterPlaceholder
        name={name}
        className={cn(ratio === "fill" ? "h-full aspect-auto" : undefined, className)}
      />
    );
  }

  const isExternal =
    src.startsWith("https://") || src.startsWith("http://");

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        ratio === "poster" ? "aspect-[2/3]" : "h-full",
        className,
      )}
    >
      <PosterImageFallback
        name={name}
        src={src}
        sizes={sizes}
        className="object-cover"
        priority={priority}
        fetchPriority={fetchPriority ?? (priority ? "high" : undefined)}
        // External posters (TMDB included) skip Vercel Image Optimization: the
        // file size is picked per use through tmdbSize, or by the browser from TMDB's sizes.
        unoptimized={isExternal}
        tmdbResponsive={responsive && TMDB_SIZED.test(src)}
        placeholderClassName="absolute inset-0 h-full"
      />
    </div>
  );
};
