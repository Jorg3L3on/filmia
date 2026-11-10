"use client";

import { useRef, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { useAmbientPause, useAtmosphereOn } from "@/lib/motion-atmosphere";

type ProjectorBeamProps = {
  /** Off by default: a screen opts in (Hoy turns it on in FIL-I46-2). */
  on?: boolean;
  /** Dust motes drifting in the beam. */
  dust?: boolean;
  /** RGB triplet (`"255 186 120"`) tinting the light; defaults to warm projector white. */
  tint?: string;
  className?: string;
};

/**
 * A projector's cone of light from the top of its box (FIL-I46-1). Absolute, behind its
 * siblings, pointer-transparent. Only opacity and transform loop, it pauses off screen, and
 * it never mounts under reduced motion or lite sala.
 */
export const ProjectorBeam = ({ on = false, dust = true, tint, className }: ProjectorBeamProps) => {
  const allowed = useAtmosphereOn();
  const ref = useRef<HTMLDivElement>(null);
  const mounted = on && allowed;
  useAmbientPause(ref, mounted);
  if (!mounted) {
    return null;
  }
  return (
    <div
      ref={ref}
      aria-hidden
      data-projector-beam
      className={cn("projector-beam", className)}
      style={tint ? ({ "--beam-rgb": tint } as CSSProperties) : undefined}
    >
      <div className="projector-beam-cone" />
      {dust ? <div className="projector-beam-dust" /> : null}
    </div>
  );
};
