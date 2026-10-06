/**
 * Bienvenida — the post-registration onboarding. Pure module (no DB, no React): the proxy imports
 * `ONBOARDING_PATH` from here, so keep it side-effect free.
 */

export const ONBOARDING_PATH = "/bienvenida";

export const ONBOARDING_STEPS = [
  "intro",
  "favorita",
  "anio",
  "plataformas",
  "quiero-ver",
  "noche",
  "primera-noche",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export type OnboardingDirection = "forward" | "back";

export const FIRST_STEP: OnboardingStepId = ONBOARDING_STEPS[0];

export const isOnboardingStepId = (value: unknown): value is OnboardingStepId =>
  typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);

export const stepIndex = (step: OnboardingStepId) => ONBOARDING_STEPS.indexOf(step);

export const nextStep = (step: OnboardingStepId): OnboardingStepId | null =>
  ONBOARDING_STEPS[stepIndex(step) + 1] ?? null;

export const prevStep = (step: OnboardingStepId): OnboardingStepId | null =>
  stepIndex(step) > 0 ? (ONBOARDING_STEPS[stepIndex(step) - 1] ?? null) : null;

export const stepDirection = (from: OnboardingStepId, to: OnboardingStepId): OnboardingDirection =>
  stepIndex(to) >= stepIndex(from) ? "forward" : "back";

export type OnboardingMode = "gated" | "rerun";

/** Where to open the flow: gated users resume where they left off; a rerun always starts at the intro. */
export const resolveInitialStep = (profile: {
  onboardedAt: Date | null;
  onboardingStep: string | null;
}): OnboardingStepId => {
  if (profile.onboardedAt) {
    return FIRST_STEP;
  }
  return isOnboardingStepId(profile.onboardingStep) ? profile.onboardingStep : FIRST_STEP;
};

export const STEP_COPY: Record<OnboardingStepId, { eyebrow: string; title: string }> = {
  intro: { eyebrow: "Bienvenida", title: "Bienvenido a Filmia" },
  favorita: { eyebrow: "De todos los tiempos", title: "Tu película favorita" },
  anio: { eyebrow: "Este año", title: "Lo mejor del año" },
  plataformas: { eyebrow: "Dónde ves", title: "Tus plataformas" },
  "quiero-ver": { eyebrow: "Quiero ver", title: "¿Qué quieres ver?" },
  noche: { eyebrow: "Tu reloj", title: "Esta noche" },
  "primera-noche": { eyebrow: "Listo", title: "Tu primera noche" },
};

export const stepAnnouncement = (step: OnboardingStepId) =>
  `Paso ${stepIndex(step) + 1} de ${ONBOARDING_STEPS.length}: ${STEP_COPY[step].title}`;
