import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { OnboardingSkeleton } from "@/components/onboarding/OnboardingSkeleton";
import { SessionResync } from "@/components/onboarding/SessionResync";
import { getOnboardingLibrary, getOnboardingYearGrid } from "@/lib/onboarding/load";
import { resolveBienvenidaEntry, resolveInitialStep } from "@/lib/onboarding/steps";
import { resolveOnboardingYear } from "@/lib/onboarding/year";
import { getCurrentUserProfile } from "@/lib/queries";
import { auth } from "@/lib/session";
import { safeNextPath } from "@/lib/google-oauth";
import { isTmdbConfigured } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bienvenida",
} as const;

type BienvenidaPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Bienvenida — the first-run flow: favorita, lo mejor del año, plataformas, Quiero ver, hora de dormir.
 * `callbackUrl` (same-origin path only) is where finishing it lands instead of Hoy (FIL-41).
 */
export default function BienvenidaPage({ searchParams }: BienvenidaPageProps) {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <BienvenidaBody searchParams={searchParams} />
    </Suspense>
  );
}

const BienvenidaBody = async ({ searchParams }: BienvenidaPageProps) => {
  const [session, profile, params] = await Promise.all([auth(), getCurrentUserProfile(), searchParams]);
  const callback = params.callbackUrl;
  const next = safeNextPath(typeof callback === "string" ? callback : null);
  if (!profile) {
    notFound();
  }

  const entry = resolveBienvenidaEntry({ onboardedAt: profile.onboardedAt, cookieOnboarded: session?.onboarded });
  if (entry === "resync") {
    return (
      <>
        <OnboardingSkeleton />
        <SessionResync next={next} />
      </>
    );
  }
  if (entry === "home") {
    redirect(next);
  }

  const library = await getOnboardingLibrary(profile.id);
  const tmdbConfigured = isTmdbConfigured();
  const year = resolveOnboardingYear(new Date());
  // Streams to the client and resolves while the person is still on the first steps.
  const yearGridPromise = tmdbConfigured ? getOnboardingYearGrid(year) : Promise.resolve({ year, items: [] });

  return (
    <OnboardingFlow
      initialStep={resolveInitialStep(profile)}
      userName={profile.name}
      yearGridPromise={yearGridPromise}
      platforms={profile.streamingPlatforms}
      nightEnds={profile.nightEnds}
      library={library}
      tmdbConfigured={tmdbConfigured}
      returnTo={next}
    />
  );
};
