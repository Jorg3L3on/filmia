"use client";

import type { CSSProperties } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

type QueVerAtmosphereProps = {
  /** Space-separated RGB channels for the spotlight tint. */
  glowRgb: string;
};

/**
 * Room atmosphere behind the soft-coverflow mazo (JOR-226 / JOR-228).
 * Does not alter card fan / radii / blur — layer sits under the stage.
 */
export const QueVerAtmosphere = ({ glowRgb }: QueVerAtmosphereProps) => {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      className="que-ver-atmosphere"
      style={{ "--que-ver-glow": glowRgb } as CSSProperties}
      aria-hidden
    >
      <div className="que-ver-atmosphere-vignette" />
      <div className="que-ver-atmosphere-haze" />
      <div className="que-ver-atmosphere-spotlight" />
      <div
        className={
          reducedMotion
            ? "que-ver-atmosphere-grain is-static"
            : "que-ver-atmosphere-grain"
        }
      />
    </div>
  );
};
