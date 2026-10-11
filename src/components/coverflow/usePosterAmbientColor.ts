"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  AMBIENT_FALLBACK_RGB,
  formatAmbientRgb,
  normalizePosterAmbientPath,
  parseAmbientRgb,
  type AmbientRgb,
} from "@/lib/poster-ambient";

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

/**
 * Seed (the card's `posterAmbient`) and the in-memory cache are checked by the hook;
 * a miss asks `/api/poster-ambient` (server sharp, CDN-cached). TMDB sends no CORS
 * headers, so sampling the poster in a canvas would need Next's image optimizer, which
 * bills a Vercel transformation per poster.
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

  const request = fetchAmbientFromApi(posterPath)
    .then((sampled) => {
      cache.set(posterPath, sampled);
      return sampled;
    })
    .finally(() => {
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

type GradeSlot = "a" | "b";

/**
 * Propagate the deck's grade to the deck root, the enclosing `.diario-que-ver-shell` and
 * <html>, so the full-bleed wash can sit behind SiteHeader. No-op when not cinematic.
 *
 * The big washes are blurred, blended, full-viewport layers: repainting them is the most
 * expensive thing the sala does, and `--que-ver-glow` can't be interpolated by CSS anyway.
 * So they come in two slots (`.que-ver-slot-a` / `-b`, html and shell ::before / ::after).
 * A new color goes into the hidden slot once and `html[data-que-ver-slot]` flips: the
 * browser crossfades the slots' opacity on the compositor, with no repaint per frame.
 * `--que-ver-glow` itself (titles, chips, rail halo: small, cheap) switches at once.
 */
export const useAmbientGrade = (
  deckRootRef: RefObject<HTMLElement | null>,
  cssRgb: string,
  cinematic: boolean,
) => {
  const slotRef = useRef<GradeSlot>("a");
  const shownRef = useRef<string | null>(null);

  useEffect(() => {
    if (!cinematic) {
      return;
    }
    const shell = deckRootRef.current?.closest(".diario-que-ver-shell") as HTMLElement | null;
    const root = document.documentElement;
    shell?.setAttribute("data-que-ver-grade", "live");
    root.dataset.queVerGrade = "live";
    root.dataset.queVerSlot = slotRef.current;
    return () => {
      shownRef.current = null;
      for (const node of [shell, root]) {
        node?.style.removeProperty("--que-ver-glow");
        node?.style.removeProperty("--que-ver-glow-a");
        node?.style.removeProperty("--que-ver-glow-b");
      }
      shell?.removeAttribute("data-que-ver-grade");
      delete root.dataset.queVerGrade;
      delete root.dataset.queVerSlot;
    };
  }, [cinematic, deckRootRef]);

  useEffect(() => {
    if (!cinematic || shownRef.current === cssRgb) {
      return;
    }
    const deckRoot = deckRootRef.current;
    const shell = deckRoot?.closest(".diario-que-ver-shell") as HTMLElement | null;
    const root = document.documentElement;
    const nodes = [deckRoot, shell, root].filter((node): node is HTMLElement => node != null);
    // First color fills the visible slot; every later one goes to the hidden slot, then flips.
    const slot: GradeSlot =
      shownRef.current == null ? slotRef.current : slotRef.current === "a" ? "b" : "a";
    for (const node of nodes) {
      node.style.setProperty(`--que-ver-glow-${slot}`, cssRgb);
      node.style.setProperty("--que-ver-glow", cssRgb);
    }
    shownRef.current = cssRgb;
    slotRef.current = slot;
    root.dataset.queVerSlot = slot;
  }, [cinematic, cssRgb, deckRootRef]);
};
