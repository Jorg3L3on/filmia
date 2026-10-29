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

/**
 * «Elige 3 para empezar»: not on the film strip. The flow detours here before Hoy whenever the
 * account has fewer than {@link MIN_ONBOARDING_TITLES} titles (FIL-I11).
 */
export const QUICK_PICK_STEP = "tres";

/** Nobody enters Hoy with an empty account: 10 of 18 finished the first Bienvenida with 0 titles. */
export const MIN_ONBOARDING_TITLES = 3;

export type OnboardingStepId =
  | (typeof ONBOARDING_STEPS)[number]
  | typeof QUICK_PICK_STEP;

export type OnboardingDirection = "forward" | "back";

export const FIRST_STEP: OnboardingStepId = ONBOARDING_STEPS[0];

export const isOnboardingStepId = (value: unknown): value is OnboardingStepId =>
  typeof value === "string" &&
  (value === QUICK_PICK_STEP || (ONBOARDING_STEPS as readonly string[]).includes(value));

export const needsQuickPicks = (titleCount: number) => titleCount < MIN_ONBOARDING_TITLES;

/** Position on the film strip. The quick-pick detour sits on the last hole, right before Hoy. */
export const stepIndex = (step: OnboardingStepId) =>
  step === QUICK_PICK_STEP ? ONBOARDING_STEPS.length - 1 : ONBOARDING_STEPS.indexOf(step);

/** Order for slide direction: the detour sits between «noche» and «primera-noche». */
const stepOrder = (step: OnboardingStepId) =>
  step === QUICK_PICK_STEP ? ONBOARDING_STEPS.indexOf("noche") + 0.5 : ONBOARDING_STEPS.indexOf(step);

/**
 * Forward through the strip. With fewer than three titles, «noche» leads to the quick picks
 * instead of the payoff; the quick picks always lead to the payoff, the last step before Hoy.
 */
export const nextStep = (step: OnboardingStepId, titleCount = MIN_ONBOARDING_TITLES): OnboardingStepId | null => {
  if (step === QUICK_PICK_STEP) {
    return "primera-noche";
  }
  if (step === "noche" && needsQuickPicks(titleCount)) {
    return QUICK_PICK_STEP;
  }
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null;
};

export const prevStep = (step: OnboardingStepId): OnboardingStepId | null => {
  if (step === QUICK_PICK_STEP) {
    return "noche";
  }
  const index = ONBOARDING_STEPS.indexOf(step);
  return index > 0 ? (ONBOARDING_STEPS[index - 1] ?? null) : null;
};

export const stepDirection = (from: OnboardingStepId, to: OnboardingStepId): OnboardingDirection =>
  stepOrder(to) >= stepOrder(from) ? "forward" : "back";

export type LeaveTarget = "finish" | typeof QUICK_PICK_STEP;

/** «Saltar por ahora» / «Entrar a Filmia»: straight to Hoy only with three titles or more. */
export const resolveLeave = (titleCount: number): LeaveTarget =>
  needsQuickPicks(titleCount) ? QUICK_PICK_STEP : "finish";

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

/** The step Rutas added after the payoff (FIL-I26-2, removed in FIL-I33): saved steps resume on the payoff. */
const REMOVED_RUTA_STEP = "ruta";

/** Where to open the flow: the Bienvenida runs once, so it resumes where the person left off. */
export const resolveInitialStep = (profile: { onboardingStep: string | null }): OnboardingStepId =>
  profile.onboardingStep === REMOVED_RUTA_STEP
    ? "primera-noche"
    : isOnboardingStepId(profile.onboardingStep)
      ? profile.onboardingStep
      : FIRST_STEP;

export const STEP_COPY: Record<OnboardingStepId, { eyebrow: string; title: string }> = {
  intro: { eyebrow: "Bienvenida", title: "Bienvenido a Filmia" },
  favorita: { eyebrow: "De todos los tiempos", title: "Tu película favorita" },
  anio: { eyebrow: "Este año", title: "Lo mejor del año" },
  plataformas: { eyebrow: "Dónde ves", title: "Tus plataformas" },
  "quiero-ver": { eyebrow: "Quiero ver", title: "¿Qué quieres ver?" },
  noche: { eyebrow: "Tu reloj", title: "Esta noche" },
  tres: { eyebrow: "Antes de entrar", title: "Elige 3 para empezar" },
  "primera-noche": { eyebrow: "Listo", title: "Tu primera noche" },
};

export const stepAnnouncement = (step: OnboardingStepId) =>
  step === QUICK_PICK_STEP
    ? `${STEP_COPY[step].eyebrow}: ${STEP_COPY[step].title}`
    : `Paso ${stepIndex(step) + 1} de ${ONBOARDING_STEPS.length}: ${STEP_COPY[step].title}`;

/** What the account holds, as the flow sees it: one entry per kind + TMDB id. */
export const countAccountTitles = (keys: Iterable<string>) => new Set(keys).size;

export const quickPickRemaining = (titleCount: number) => Math.max(0, MIN_ONBOARDING_TITLES - titleCount);
