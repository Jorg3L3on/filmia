import { PosterImageFallback } from "@/components/PosterImageFallback";
import { PosterPlaceholder } from "@/components/PosterPlaceholder";
import { cn } from "@/lib/cn";
import { tmdbPosterUrl } from "@/lib/tmdb";

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
        // file size is picked per use through tmdbSize.
        unoptimized={isExternal}
        placeholderClassName="absolute inset-0 h-full"
      />
    </div>
  );
};
