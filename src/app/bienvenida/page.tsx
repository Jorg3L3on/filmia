import { Suspense } from "react";
import { notFound } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { OnboardingSkeleton } from "@/components/onboarding/OnboardingSkeleton";
import { getOnboardingLibrary, getOnboardingYearGrid } from "@/lib/onboarding/load";
import { resolveInitialStep } from "@/lib/onboarding/steps";
import { resolveOnboardingYear } from "@/lib/onboarding/year";
import { getCurrentUserProfile } from "@/lib/queries";
import { auth } from "@/lib/session";
import { isTmdbConfigured } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bienvenida",
} as const;

/** Bienvenida — the first-run flow: favorita, lo mejor del año, plataformas, Quiero ver, hora de dormir. */
export default function BienvenidaPage() {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <BienvenidaBody />
    </Suspense>
  );
}

const BienvenidaBody = async () => {
  const [session, profile] = await Promise.all([auth(), getCurrentUserProfile()]);
  if (!profile) {
    notFound();
  }

  const library = await getOnboardingLibrary(profile.id);
  const mode = profile.onboardedAt ? "rerun" : "gated";
  const resync = mode === "rerun" && session?.onboarded === false;
  const tmdbConfigured = isTmdbConfigured();
  const year = resolveOnboardingYear(new Date());
  // Streams to the client and resolves while the person is still on the first steps.
  const yearGridPromise = tmdbConfigured ? getOnboardingYearGrid(year) : Promise.resolve({ year, items: [] });

  return (
    <OnboardingFlow
      mode={mode}
      initialStep={resolveInitialStep(profile)}
      userName={profile.name}
      yearGridPromise={yearGridPromise}
      platforms={profile.streamingPlatforms}
      nightEnds={profile.nightEnds}
      library={library}
      tmdbConfigured={tmdbConfigured}
      resync={resync}
    />
  );
};
