"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AMBIENT_FALLBACK_RGB,
  formatAmbientRgb,
  sampleAmbientFromImageData,
  softenAmbientRgb,
  type AmbientRgb,
} from "@/lib/poster-ambient";
import { tmdbPosterUrl } from "@/lib/tmdb";

const cache = new Map<string, AmbientRgb>();

const samplePosterPath = (posterPath: string | null | undefined) => {
  if (!posterPath) {
    return null;
  }
  return tmdbPosterUrl(posterPath, "w185");
};

export const usePosterAmbientColor = (posterPath: string | null | undefined) => {
  const src = samplePosterPath(posterPath);
  const [tick, setTick] = useState(0);
  const rgb = useMemo(() => {
    void tick;
    if (!src) {
      return AMBIENT_FALLBACK_RGB;
    }
    return cache.get(src) ?? AMBIENT_FALLBACK_RGB;
  }, [src, tick]);

  useEffect(() => {
    if (!src || cache.has(src)) {
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";

    image.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          return;
        }
        ctx.drawImage(image, 0, 0, size, size);
        const sampled = softenAmbientRgb(
          sampleAmbientFromImageData(ctx.getImageData(0, 0, size, size)),
        );
        cache.set(src, sampled);
        if (!cancelled) {
          setTick((value) => value + 1);
        }
      } catch {
        // Keep fallback indigo.
      }
    };
    image.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  return {
    rgb,
    cssRgb: formatAmbientRgb(rgb),
    style: { "--que-ver-glow": formatAmbientRgb(rgb) } as CSSProperties,
  };
};
