"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AMBIENT_FALLBACK_RGB,
  formatAmbientRgb,
  normalizePosterAmbientPath,
  sampleAmbientFromImageData,
  softenAmbientRgb,
  type AmbientRgb,
} from "@/lib/poster-ambient";
import { tmdbPosterUrl } from "@/lib/tmdb";

const cache = new Map<string, AmbientRgb>();
const inflight = new Map<string, Promise<AmbientRgb>>();

const parseAmbientPayload = (payload: unknown): AmbientRgb | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const r = Number(record.r);
  const g = Number(record.g);
  const b = Number(record.b);
  if (![r, g, b].every((channel) => Number.isFinite(channel))) {
    return null;
  }
  return {
    r: Math.min(255, Math.max(0, Math.round(r))),
    g: Math.min(255, Math.max(0, Math.round(g))),
    b: Math.min(255, Math.max(0, Math.round(b))),
  };
};

/** Same-origin Next image optimizer URL — canvas-safe, no CORS taint. */
const sameOriginPosterSrc = (posterPath: string) => {
  if (posterPath.startsWith("/posters/")) {
    return posterPath;
  }
  const remote = tmdbPosterUrl(posterPath, "w185");
  if (!remote) {
    return null;
  }
  if (remote.startsWith("/")) {
    return remote;
  }
  return `/_next/image?url=${encodeURIComponent(remote)}&w=96&q=75`;
};

const sampleFromSameOriginImage = (src: string) =>
  new Promise<AmbientRgb>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    // Same-origin (/_next/image or /posters) — do NOT set crossOrigin (avoids taint path).
    image.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(AMBIENT_FALLBACK_RGB);
          return;
        }
        ctx.drawImage(image, 0, 0, size, size);
        const sampled = softenAmbientRgb(
          sampleAmbientFromImageData(ctx.getImageData(0, 0, size, size)),
        );
        resolve(sampled);
      } catch {
        resolve(AMBIENT_FALLBACK_RGB);
      }
    };
    image.onerror = () => resolve(AMBIENT_FALLBACK_RGB);
    image.src = src;
  });

const fetchAmbientFromApi = async (posterPath: string): Promise<AmbientRgb> => {
  try {
    const response = await fetch(
      `/api/poster-ambient?path=${encodeURIComponent(posterPath)}`,
      { credentials: "same-origin" },
    );
    if (!response.ok) {
      return AMBIENT_FALLBACK_RGB;
    }
    return parseAmbientPayload(await response.json()) ?? AMBIENT_FALLBACK_RGB;
  } catch {
    return AMBIENT_FALLBACK_RGB;
  }
};

const isFallback = (rgb: AmbientRgb) =>
  rgb.r === AMBIENT_FALLBACK_RGB.r &&
  rgb.g === AMBIENT_FALLBACK_RGB.g &&
  rgb.b === AMBIENT_FALLBACK_RGB.b;

/**
 * Prefer same-origin `/_next/image` canvas sample (no CORS taint).
 * If that yields indigo fallback, try harder via `/api/poster-ambient` (server sharp).
 */
const resolveAmbient = async (posterPath: string): Promise<AmbientRgb> => {
  const cached = cache.get(posterPath);
  if (cached) {
    return cached;
  }

  const pending = inflight.get(posterPath);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    const sameOrigin = sameOriginPosterSrc(posterPath);
    let sampled = AMBIENT_FALLBACK_RGB;
    if (sameOrigin) {
      sampled = await sampleFromSameOriginImage(sameOrigin);
    }
    if (isFallback(sampled)) {
      const fromApi = await fetchAmbientFromApi(posterPath);
      if (!isFallback(fromApi)) {
        sampled = fromApi;
      }
    }
    cache.set(posterPath, sampled);
    return sampled;
  })().finally(() => {
    inflight.delete(posterPath);
  });

  inflight.set(posterPath, request);
  return request;
};

export const usePosterAmbientColor = (posterPath: string | null | undefined) => {
  const path = normalizePosterAmbientPath(posterPath);
  const [tick, setTick] = useState(0);
  const rgb = useMemo(() => {
    void tick;
    if (!path) {
      return AMBIENT_FALLBACK_RGB;
    }
    return cache.get(path) ?? AMBIENT_FALLBACK_RGB;
  }, [path, tick]);

  useEffect(() => {
    if (!path) {
      return;
    }
    if (cache.has(path)) {
      return;
    }

    let cancelled = false;
    void resolveAmbient(path).then((sampled) => {
      if (cancelled) {
        return;
      }
      cache.set(path, sampled);
      setTick((value) => value + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return {
    rgb,
    cssRgb: formatAmbientRgb(rgb),
    style: { "--que-ver-glow": formatAmbientRgb(rgb) } as CSSProperties,
  };
};
