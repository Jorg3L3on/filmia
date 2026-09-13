"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { tmdbPosterUrl } from "@/lib/tmdb";

type QueVerAtmosphereProps = {
  /** Space-separated RGB channels for the spotlight tint. */
  glowRgb: string;
  /** Soft double-exposure of the next poster in the haze (C). */
  ghostPosterPath?: string | null;
  /** 0–1 strength; raised near deck edge / continuum. */
  ghostOpacity?: number;
  /** Bumps to retrigger the warm light-leak streak after «Vi esto». */
  lightLeakKey?: number;
};

/**
 * Room atmosphere behind the soft-coverflow mazo (JOR-226 / JOR-228).
 * Norte C «Película viva»: grade + grain/flicker + sprockets + ghost + leak.
 * Does not alter card fan / radii / blur — layer sits under the stage.
 */
export const QueVerAtmosphere = ({
  glowRgb,
  ghostPosterPath = null,
  ghostOpacity = 0,
  lightLeakKey = 0,
}: QueVerAtmosphereProps) => {
  const reducedMotion = usePrefersReducedMotion();
  const ghostSrc = tmdbPosterUrl(ghostPosterPath, "w185");
  const showGhost = Boolean(ghostSrc) && ghostOpacity > 0.02;

  return (
    <div
      className={
        reducedMotion
          ? "que-ver-atmosphere is-reduced-motion"
          : "que-ver-atmosphere"
      }
      style={{ "--que-ver-glow": glowRgb } as CSSProperties}
      aria-hidden
    >
      <div className="que-ver-atmosphere-grade" />
      <div className="que-ver-atmosphere-vignette" />
      <div className="que-ver-atmosphere-haze" />
      <div className="que-ver-atmosphere-spotlight" />
      <div className="que-ver-atmosphere-floor" />
      {showGhost && ghostSrc ? (
        <div
          className="que-ver-atmosphere-ghost"
          style={{ opacity: Math.min(0.55, Math.max(0, ghostOpacity)) }}
        >
          <Image
            src={ghostSrc}
            alt=""
            fill
            sizes="280px"
            className="object-cover"
            draggable={false}
          />
        </div>
      ) : null}
      <div className="que-ver-atmosphere-sprockets" data-side="left" />
      <div className="que-ver-atmosphere-sprockets" data-side="right" />
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
