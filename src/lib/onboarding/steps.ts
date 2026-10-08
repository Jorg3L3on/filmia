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

export type BienvenidaEntry = "flow" | "resync" | "home";

/**
 * The Bienvenida runs once. A finished account goes to Hoy; if this device's cookie still says
 * «not onboarded» (DB already does), it re-mints the cookie first so the proxy stops sending it back.
 */
export const resolveBienvenidaEntry = ({
  onboardedAt,
  cookieOnboarded,
}: {
  onboardedAt: Date | null;
  cookieOnboarded: boolean | undefined;
}): BienvenidaEntry => {
  if (!onboardedAt) {
    return "flow";
  }
  return cookieOnboarded === false ? "resync" : "home";
};

/** Where to open the flow: the Bienvenida runs once, so it resumes where the person left off. */
export const resolveInitialStep = (profile: { onboardingStep: string | null }): OnboardingStepId =>
  isOnboardingStepId(profile.onboardingStep) ? profile.onboardingStep : FIRST_STEP;

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
