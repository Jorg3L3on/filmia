"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { PosterPlaceholder } from "@/components/PosterPlaceholder";

type PosterImageFallbackProps = Omit<ImageProps, "alt" | "fill" | "onError" | "unoptimized"> & {
  name: string;
  /** PosterImage decides it (external posters skip Vercel's optimizer); it is required here on purpose. */
  unoptimized: boolean;
  /** Placeholder classes (the plate takes the poster's slot). */
  placeholderClassName?: string;
};

/**
 * The poster `<img>` with a safety net (FIL-I24-5): a path TMDB no longer serves, or a seed
 * path that never existed, shows the dark plate with the initial instead of the browser's
 * broken-image glyph. Client leaf so `PosterImage` itself can stay a server component.
 */
export const PosterImageFallback = ({ name, unoptimized, placeholderClassName, ...image }: PosterImageFallbackProps) => {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return <PosterPlaceholder name={name} className={placeholderClassName} />;
  }

  return <Image {...image} alt={`Poster de ${name}`} fill unoptimized={unoptimized} onError={() => setBroken(true)} />;
};
