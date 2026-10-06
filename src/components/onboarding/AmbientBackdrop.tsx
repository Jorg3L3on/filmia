"use client";

import type { CSSProperties } from "react";
import { tmdbPosterUrl } from "@/lib/tmdb";

type AmbientBackdropProps = {
  /** "r g b" string (poster-sampled) or null for the Filmia accent. */
  ambient: string | null;
  posterPath: string | null;
};

/** Fixed layer behind the flow: a blurred wash of the favorite's poster plus its sampled glow. */
export const AmbientBackdrop = ({ ambient, posterPath }: AmbientBackdropProps) => {
  const poster = tmdbPosterUrl(posterPath, "w342");
  const style = { "--que-ver-glow": ambient ?? "124 156 255" } as CSSProperties;
  return (
    <div className="bienvenida-backdrop" aria-hidden="true" style={style}>
      <div className="bienvenida-glow" />
      {poster ? (
        <div
          key={poster}
          className="bienvenida-poster-wash"
          style={{ backgroundImage: `url(${poster})` }}
        />
      ) : null}
      <div className="bienvenida-grain" />
    </div>
  );
};
