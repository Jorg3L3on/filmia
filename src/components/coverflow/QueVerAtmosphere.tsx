"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { tmdbPosterUrl } from "@/lib/tmdb";

type QueVerAtmosphereProps = {
  /** Soft double-exposure of the next poster in the haze (C). */
  ghostPosterPath?: string | null;
  /** 0–1 strength; raised near deck edge / continuum. */
  ghostOpacity?: number;
  /** Bumps to retrigger the warm light-leak streak after «Vi esto». */
  lightLeakKey?: number;
};

type GhostLayer = { id: number; src: string; ready: boolean; leaving: boolean };

/** Matches `.que-ver-atmosphere-ghost`'s opacity transition (`--duration-morph`) plus slack. */
const GHOST_LEAVE_MS = 450;

/**
 * The next poster's ghost crossfades instead of swapping its src in place: the outgoing
 * layer fades out over the incoming one, which fades in once its image has loaded.
 * At most one layer is ever leaving, so a fast swipe never stacks blurred, blended layers.
 */
const useGhostLayers = (src: string | null) => {
  const [shownSrc, setShownSrc] = useState(src);
  const [layers, setLayers] = useState<GhostLayer[]>(() =>
    src ? [{ id: 0, src, ready: false, leaving: false }] : [],
  );

  if (src !== shownSrc) {
    setShownSrc(src);
    setLayers((prev) => {
      const current = prev.filter((layer) => !layer.leaving);
      const nextId = prev.reduce((max, layer) => Math.max(max, layer.id), -1) + 1;
      return [
        ...current.slice(-1).map((layer) => ({ ...layer, leaving: true })),
        ...(src ? [{ id: nextId, src, ready: false, leaving: false }] : []),
      ];
    });
  }

  const hasLeaving = layers.some((layer) => layer.leaving);
  useEffect(() => {
    if (!hasLeaving) {
      return;
    }
    const timer = window.setTimeout(() => {
      setLayers((prev) => prev.filter((layer) => !layer.leaving));
    }, GHOST_LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [hasLeaving, shownSrc]);

  const markReady = (id: number) =>
    setLayers((prev) =>
      prev.map((layer) => (layer.id === id ? { ...layer, ready: true } : layer)),
    );

  return { layers, markReady };
};

/**
 * Room atmosphere behind the soft-coverflow mazo (JOR-226 / JOR-228).
 * Norte C «Película viva»: grade + grain/flicker + ghost + leak (no sprockets).
 * Does not alter card fan / radii / blur — layer sits under the stage.
 */
export const QueVerAtmosphere = ({
  ghostPosterPath = null,
  ghostOpacity = 0,
  lightLeakKey = 0,
}: QueVerAtmosphereProps) => {
  const reducedMotion = usePrefersReducedMotion();
  const ghostSrc = tmdbPosterUrl(ghostPosterPath, "w185");
  const showGhost = Boolean(ghostSrc) && ghostOpacity > 0.02;
  const ghost = useGhostLayers(showGhost ? ghostSrc : null);
  const ghostStrength = Math.min(0.72, Math.max(0, ghostOpacity));

  return (
    <div
      className={
        reducedMotion
          ? "que-ver-atmosphere is-reduced-motion"
          : "que-ver-atmosphere"
      }
      aria-hidden
    >
      <div className="que-ver-atmosphere-grade" />
      <div className="que-ver-atmosphere-vignette" />
      <div className="que-ver-atmosphere-haze" />
      <div className="que-ver-atmosphere-floor" />
      {ghost.layers.map((layer) => (
        <div
          key={layer.id}
          className="que-ver-atmosphere-ghost"
          style={{ opacity: layer.ready && !layer.leaving ? ghostStrength : 0 }}
        >
          <Image
            src={layer.src}
            alt=""
            fill
            sizes="280px"
            className="object-cover"
            draggable={false}
            onLoad={() => ghost.markReady(layer.id)}
          />
        </div>
      ))}
      <div
        className={
          reducedMotion
            ? "que-ver-atmosphere-grain is-static"
            : "que-ver-atmosphere-grain"
        }
      />
      <div
        className={
          reducedMotion
            ? "que-ver-atmosphere-flicker is-static"
            : "que-ver-atmosphere-flicker"
        }
      />
      {lightLeakKey > 0 ? (
        <div
          key={lightLeakKey}
          className={
            reducedMotion
              ? "que-ver-atmosphere-leak is-static"
              : "que-ver-atmosphere-leak"
          }
        />
      ) : null}
    </div>
  );
};
