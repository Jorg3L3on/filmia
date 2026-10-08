"use client";

import type { RefObject } from "react";
import { BedtimeDial, nightEndsStatusCopy, useNightEndsSave } from "@/components/onboarding/BedtimeDial";
import { StepHeader } from "@/components/onboarding/StepHeader";
import type { NightEnds } from "@/lib/tonight/types";

type BedtimeStepProps = {
  value: NightEnds;
  onChange: (next: NightEnds) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export const BedtimeStep = ({ value, onChange, headingRef }: BedtimeStepProps) => {
  const { status, persist } = useNightEndsSave();

  return (
    <div className="space-y-6">
      <StepHeader
        headingRef={headingRef}
        eyebrow="Tu reloj"
        title={
          <>
            ¿Hasta qué hora <span className="text-accent">ves</span>?
          </>
        }
        lede="Con esto Hoy te dice si termina a tiempo: «acaba a las 23:19» o «se pasa 14 min»."
      />

      <BedtimeDial
        value={value}
        onChange={(next) => {
          onChange(next);
          persist(next);
        }}
      />

      <p className="min-h-5 text-center text-xs text-mist" aria-live="polite">
        {nightEndsStatusCopy(status)}
      </p>
    </div>
  );
};
