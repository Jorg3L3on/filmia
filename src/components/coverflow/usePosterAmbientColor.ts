"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  AMBIENT_FALLBACK_RGB,
  easeOutAmbient,
  formatAmbientRgb,
  mixAmbientRgb,
  normalizePosterAmbientPath,
  parseAmbientRgb,
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

export const usePosterAmbientColor = (
  posterPath: string | null | undefined,
  seedRgb: string | null = null,
) => {
  const path = normalizePosterAmbientPath(posterPath);
  // Esta noche ships the sampled color with the card: correct glow on first paint.
  if (path && !cache.has(path)) {
    const seeded = parseAmbientRgb(seedRgb);
    if (seeded) {
      cache.set(path, seeded);
    }
  }
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

/** How long the sala takes to blend from one poster's light to the next. */
const GRADE_BLEND_MS = 600;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Propagate the deck's grade to the deck root, the enclosing `.diario-que-ver-shell` and
 * <html>, so the full-bleed wash can sit behind SiteHeader. No-op when not cinematic.
 *
 * `--que-ver-glow` is an unregistered "r g b" string: CSS can't interpolate it (nor the
 * gradients built from it), so a new poster used to snap the whole room. The blend runs
 * here, one rAF loop for GRADE_BLEND_MS, retargeting from wherever it is mid-swipe.
 */
export const useAmbientGrade = (
  deckRootRef: RefObject<HTMLElement | null>,
  cssRgb: string,
  cinematic: boolean,
) => {
  const shownRef = useRef<AmbientRgb | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!cinematic) {
      return;
    }
    const deckRoot = deckRootRef.current;
    const shell = deckRoot?.closest(".diario-que-ver-shell") as HTMLElement | null;
    const root = document.documentElement;
    shell?.setAttribute("data-que-ver-grade", "live");
    root.dataset.queVerGrade = "live";
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      shownRef.current = null;
      shell?.style.removeProperty("--que-ver-glow");
      shell?.removeAttribute("data-que-ver-grade");
      root.style.removeProperty("--que-ver-glow");
      delete root.dataset.queVerGrade;
    };
  }, [cinematic, deckRootRef]);

  useEffect(() => {
    if (!cinematic) {
      return;
    }
    const target = parseAmbientRgb(cssRgb) ?? AMBIENT_FALLBACK_RGB;
    const deckRoot = deckRootRef.current;
    const shell = deckRoot?.closest(".diario-que-ver-shell") as HTMLElement | null;
    const nodes = [deckRoot, shell, document.documentElement].filter(
      (node): node is HTMLElement => node != null,
    );
    const write = (rgb: AmbientRgb) => {
      shownRef.current = rgb;
      const value = formatAmbientRgb(rgb);
      nodes.forEach((node) => node.style.setProperty("--que-ver-glow", value));
    };

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const from = shownRef.current;
    if (!from || prefersReducedMotion()) {
      write(target);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / GRADE_BLEND_MS;
      write(mixAmbientRgb(from, target, easeOutAmbient(t)));
      rafRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    rafRef.current = requestAnimationFrame(step);
  }, [cinematic, cssRgb, deckRootRef]);
};
