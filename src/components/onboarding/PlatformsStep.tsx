"use client";

import type { RefObject } from "react";
import { updateStreamingPlatforms } from "@/app/actions/profile";
import { PlatformToggleGrid } from "@/components/PlatformToggleGrid";
import { StepHeader } from "@/components/onboarding/StepHeader";
import type { Platform } from "@/db";
import { formatUserPlatformsList } from "@/lib/streaming-platforms";

type PlatformsStepProps = {
  value: Platform[];
  onChange: (next: Platform[]) => void;
  isPending: boolean;
  error: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export const PlatformsStep = ({ value, onChange, isPending, error, headingRef }: PlatformsStepProps) => {
  const toggle = (platform: Platform) => {
    onChange(value.includes(platform) ? value.filter((item) => item !== platform) : [...value, platform]);
  };

  return (
    <div className="space-y-6">
      <StepHeader
        headingRef={headingRef}
        eyebrow="Dónde ves"
        title={
          <>
            Tus <span className="text-accent">plataformas</span>
          </>
        }
        lede="Hoy solo propone lo incluido en tus suscripciones de México. Renta y compra no cuentan."
      />
      {error ? (
        <p role="alert" className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <PlatformToggleGrid value={value} onToggle={toggle} disabled={isPending} variant="roomy" />
      <p className="min-h-5 text-sm text-fog" aria-live="polite">
        {value.length === 0
          ? "Elige al menos una para que Hoy tenga de dónde escoger."
          : `Hoy buscará en ${formatUserPlatformsList(value)}.`}
      </p>
    </div>
  );
};

export { updateStreamingPlatforms };
