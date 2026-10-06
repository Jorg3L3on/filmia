"use client";

import { ONBOARDING_STEPS, STEP_COPY, stepIndex, type OnboardingStepId } from "@/lib/onboarding/steps";
import { cn } from "@/lib/cn";

type FilmStripProgressProps = {
  step: OnboardingStepId;
};

/** Sprocket holes of a film strip: one per step, the current one lit. */
export const FilmStripProgress = ({ step }: FilmStripProgressProps) => {
  const current = stepIndex(step);
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={ONBOARDING_STEPS.length}
      aria-valuenow={current + 1}
      aria-valuetext={`Paso ${current + 1} de ${ONBOARDING_STEPS.length}: ${STEP_COPY[step].title}`}
      className="film-strip"
    >
      {ONBOARDING_STEPS.map((id, index) => (
        <span
          key={id}
          className={cn(
            "film-hole",
            index < current && "is-done",
            index === current && "is-current spring-pop",
          )}
        />
      ))}
    </div>
  );
};
