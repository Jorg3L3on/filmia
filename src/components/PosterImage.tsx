import Image from "next/image";
import { PosterPlaceholder } from "@/components/PosterPlaceholder";
import { cn } from "@/lib/cn";
import { tmdbPosterUrl } from "@/lib/tmdb";

type PosterImageProps = {
  name: string;
  posterPath?: string | null;
  className?: string;
  priority?: boolean;
};

export const PosterImage = ({
  name,
  posterPath,
  className,
  priority = false,
}: PosterImageProps) => {
  const src = tmdbPosterUrl(posterPath, "w342");

  if (!src) {
    return <PosterPlaceholder name={name} className={className} />;
  }

  return (
    <div className={cn("relative aspect-[2/3] w-full overflow-hidden", className)}>
      <Image
        src={src}
        alt={`Poster de ${name}`}
        fill
        sizes="(max-width: 768px) 50vw, 220px"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
};
