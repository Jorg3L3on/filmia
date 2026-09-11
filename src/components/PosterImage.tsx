import Image from "next/image";
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
};

export const PosterImage = ({
  name,
  posterPath,
  className,
  priority = false,
  fetchPriority,
  sizes = "(max-width: 768px) 50vw, 220px",
  ratio = "poster",
}: PosterImageProps) => {
  const src = tmdbPosterUrl(posterPath, "w342");

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
  const isTmdb = src.includes("image.tmdb.org") || src.includes("media.themoviedb.org");

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        ratio === "poster" ? "aspect-[2/3]" : "h-full",
        className,
      )}
    >
      <Image
        src={src}
        alt={`Poster de ${name}`}
        fill
        sizes={sizes}
        className="object-cover"
        priority={priority}
        fetchPriority={fetchPriority ?? (priority ? "high" : undefined)}
        unoptimized={isExternal && !isTmdb}
      />
    </div>
  );
};
