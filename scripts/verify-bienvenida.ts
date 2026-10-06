import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ONBOARDING_PATH, ONBOARDING_STEPS, resolveInitialStep } from "../src/lib/onboarding/steps";
import { cycleYearPick, EMPTY_YEAR_SELECTION } from "../src/lib/onboarding/year-grid";
import { hhmmToSlot, slotToHHMM } from "../src/lib/onboarding/bedtime";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const exists = (file: string) => existsSync(path.join(root, file));

const run = () => {
  // Schema + migration: additive, idempotent, backfills existing accounts.
  const schema = read("src/db/schema.ts");
  assert(schema.includes('timestamp("onboardedAt"') && schema.includes('text("onboardingStep")'), "User has onboardedAt + onboardingStep");
  assert(exists("drizzle/0007_bienvenida.sql"), "Migration 0007_bienvenida.sql exists");
  const migration = read("drizzle/0007_bienvenida.sql");
  assert((migration.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length === 2, "0007 adds both columns idempotently");
  assert(/UPDATE "User" SET "onboardedAt" = "createdAt" WHERE "onboardedAt" IS NULL/.test(migration), "0007 backfills onboardedAt for existing users");
  const journal = JSON.parse(read("drizzle/meta/_journal.json")) as { entries: Array<{ idx: number; tag: string }> };
  assert(journal.entries.some((entry) => entry.idx === 7 && entry.tag === "0007_bienvenida"), "Journal has 0007_bienvenida");
  assert(read("scripts/clone-account.ts").includes("onboardedAt") && read("scripts/seed.ts").includes("onboardedAt"), "clone-account and seed set onboardedAt");

  // Gate: JWT claim + proxy redirect + redirects after register / login / Google.
  assert(read("src/lib/auth/session-token.ts").includes("onboarded: payload.onboarded !== false"), "Missing claim ⇒ onboarded (legacy sessions never gated)");
  const proxy = read("src/proxy.ts");
  assert(proxy.includes("ONBOARDING_PATH") && proxy.includes("session?.onboarded === false"), "Proxy redirects gated sessions to /bienvenida");
  assert(read("src/app/api/auth/register/route.ts").includes("{ onboarded: false }"), "Register mints onboarded: false");
  assert(read("src/lib/auth/google.ts").includes("created: true") && read("src/lib/auth/google.ts").includes("onboarded: false"), "Google sign-up reports created + gated");
  assert(read("src/app/api/auth/google/callback/route.ts").includes("ONBOARDING_PATH"), "Google callback lands gated users on /bienvenida");
  assert(read("src/components/SignupForm.tsx").includes("router.push(ONBOARDING_PATH)"), "SignupForm pushes /bienvenida");
  assert(read("src/components/LoginForm.tsx").includes("payload.onboarding"), "LoginForm resumes the Bienvenida");
  assert(read("src/lib/nav.ts").includes('"/bienvenida"'), "Chrome hidden on /bienvenida");
  assert(read("src/lib/rendering.ts").includes("src/app/bienvenida/page.tsx"), "Bienvenida page is in the force-dynamic audit");
  assert(read("src/app/bienvenida/page.tsx").includes('export const dynamic = "force-dynamic"'), "Bienvenida page is force-dynamic");
  assert(ONBOARDING_PATH === "/bienvenida" && ONBOARDING_STEPS.length === 7, "Seven steps under /bienvenida");
  assert(resolveInitialStep({ onboardedAt: new Date(), onboardingStep: "noche" }) === "intro", "Rerun starts at the intro");

  // Flow wiring: transitions, saves through the existing actions, payoff copy.
  const flow = read("src/components/onboarding/OnboardingFlow.tsx");
  assert(flow.includes("startTransition(") && flow.includes("addTransitionType(`bienvenida-${direction}`)"), "Steps change inside a Transition with a direction type");
  assert(flow.includes("<ViewTransition key={step}"), "Steps are wrapped in a keyed ViewTransition");
  assert(flow.includes("updateStreamingPlatforms"), "Platforms step saves through updateStreamingPlatforms");
  assert(read("src/components/onboarding/BedtimeStep.tsx").includes("updateNightEnds"), "Bedtime step saves through updateNightEnds");
  assert(read("src/components/onboarding/FavoriteStep.tsx").includes("pickAllTimeFavorite"), "Favorite step saves watched + 5★ + Favoritas");
  const payoff = read("src/components/onboarding/PayoffStep.tsx");
  assert(payoff.includes("acaba a las") && flow.includes("Entrar a Filmia"), "Payoff shows the fit and the final CTA");
  assert(read("src/app/actions/onboarding.ts").includes("computeTonightForUser"), "Payoff computes Hoy inline");

  // Motion: slides reuse the diary keyframes with ease-out; spring only on tap feedback.
  const css = read("src/app/globals.css");
  for (const selector of [
    "::view-transition-old(.bienvenida-forward)",
    "::view-transition-new(.bienvenida-back)",
    ".film-hole.is-current",
    "::view-transition-group(bienvenida-chrome-top)",
    "::view-transition-group(bienvenida-chrome-bottom)",
    ".hour-drum",
    ".bedtime-moon",
    ".year-crown",
    ".visto-stamp.is-tile",
    ".payoff-card-in",
  ]) {
    assert(css.includes(selector), `CSS has ${selector}`);
  }
  const slideRules = css.match(/::view-transition-(old|new)\(\.bienvenida-(forward|back)\)\s*\{[^}]*\}/g) ?? [];
  assert(slideRules.length === 4 && slideRules.every((rule) => rule.includes("var(--ease-out)") && !rule.includes("var(--spring)")), "Step slides use ease-out, never spring");
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert(reduced.includes(".bienvenida-glow") && reduced.includes(".year-crown") && reduced.includes(".bedtime-moon"), "Reduced motion covers the Bienvenida");

  // Pure helpers behave.
  const crowned = cycleYearPick(cycleYearPick(EMPTY_YEAR_SELECTION, 7).selection, 7);
  assert(crowned.selection.favoriteTmdbId === 7, "Second tap crowns the favorite");
  assert(slotToHHMM(hhmmToSlot("00:15")) === "00:15", "Drum round-trips past midnight");

  // Entry points for existing users.
  assert(read("src/app/perfil/page.tsx").includes("Volver a la bienvenida"), "Perfil links back to the Bienvenida");
  assert(read("src/app/(diario)/page.tsx").includes('actionHref="/bienvenida"'), "Hoy's platforms empty state sends to the Bienvenida");

  console.log("verify-bienvenida: ok");
};

run();
