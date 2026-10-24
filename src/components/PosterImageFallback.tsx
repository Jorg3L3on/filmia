"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { PosterPlaceholder } from "@/components/PosterPlaceholder";
import { cn } from "@/lib/cn";

type PosterImageFallbackProps = Omit<ImageProps, "alt" | "fill" | "onError" | "unoptimized"> & {
  name: string;
  /** PosterImage decides it (external posters skip Vercel's optimizer); it is required here on purpose. */
  unoptimized: boolean;
  /** Placeholder classes (the plate takes the poster's slot). */
  placeholderClassName?: string;
  /** A TMDB URL: let the browser pick the TMDB size for `sizes` and the screen (srcset). */
  tmdbResponsive?: boolean;
};

const TMDB_POSTER_WIDTHS = [185, 342, 500, 780] as const;

/** TMDB's own poster sizes as a srcset (w780 at most: `original` is several MB). */
const tmdbSrcSet = (src: string) =>
  TMDB_POSTER_WIDTHS.map((width) => `${src.replace(/\/t\/p\/w\d+\//, `/t/p/w${width}/`)} ${width}w`).join(", ");

export const PosterImageFallback = ({
  name,
  unoptimized,
  placeholderClassName,
  tmdbResponsive = false,
  ...image
}: PosterImageFallbackProps) => {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return <PosterPlaceholder name={name} className={placeholderClassName} />;
  }

  if (tmdbResponsive && typeof image.src === "string") {
    // TMDB's files as they are, never Vercel's optimizer; next/image would list its own widths
    // (640…3840w) all pointing at one file, so the four real sizes go in by hand.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image.src}
        srcSet={tmdbSrcSet(image.src)}
        sizes={image.sizes}
        alt={`Poster de ${name}`}
        loading={image.priority ? "eager" : "lazy"}
        fetchPriority={image.fetchPriority}
        decoding="async"
        className={cn("absolute inset-0 h-full w-full", image.className)}
        onError={() => setBroken(true)}
      />
    );
  }

  return <Image {...image} alt={`Poster de ${name}`} fill unoptimized={unoptimized} onError={() => setBroken(true)} />;
};
