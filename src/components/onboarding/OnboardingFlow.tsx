"use client";

import { useRouter } from "next/navigation";
import {
  ViewTransition,
  addTransitionType,
  startTransition,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { finishOnboarding, saveOnboardingStep } from "@/app/actions/onboarding";
import { logoutUser } from "@/app/actions/auth";
import { updateStreamingPlatforms } from "@/app/actions/profile";
import { Button } from "@/components/Button";
import { AmbientBackdrop } from "@/components/onboarding/AmbientBackdrop";
import { BedtimeStep } from "@/components/onboarding/BedtimeStep";
import { FavoriteStep } from "@/components/onboarding/FavoriteStep";
import { FilmStripProgress } from "@/components/onboarding/FilmStripProgress";
import { IntroStep } from "@/components/onboarding/IntroStep";
import { PayoffStep } from "@/components/onboarding/PayoffStep";
import { PlatformsStep } from "@/components/onboarding/PlatformsStep";
import { SessionResync } from "@/components/onboarding/SessionResync";
import { WatchlistStep } from "@/components/onboarding/WatchlistStep";
import { YearStep, type YearTitleRef } from "@/components/onboarding/YearStep";
import type { FlowTitle } from "@/components/onboarding/types";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import type { LibraryEntry, SuggestionItem, YearGrid, YearGridItem } from "@/lib/onboarding/load";
import type { PayoffPayload } from "@/lib/onboarding/payoff";
import {
  nextStep,
  prevStep,
  stepAnnouncement,
  stepDirection,
  type OnboardingMode,
  type OnboardingStepId,
} from "@/lib/onboarding/steps";
import type { YearGridSelection } from "@/lib/onboarding/year-grid";
import type { NightEnds } from "@/lib/tonight/types";
import { btnLink, focusRing } from "@/lib/ui";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { sameIdList, useStickyOptimistic } from "@/lib/use-optimistic-action";

type OnboardingFlowProps = {
  mode: OnboardingMode;
  initialStep: OnboardingStepId;
  userName: string | null;
  yearGridPromise: Promise<YearGrid>;
  platforms: Platform[];
  nightEnds: NightEnds;
  library: LibraryEntry[];
  tmdbConfigured: boolean;
  /** DB says onboarded, cookie says not: re-mint and leave. */
  resync: boolean;
};

const TRANSITION_TYPES = {
  default: "none",
  "bienvenida-forward": "bienvenida-forward",
  "bienvenida-back": "bienvenida-back",
} as const;

const SEARCH_STEPS: OnboardingStepId[] = ["favorita", "anio", "quiero-ver"];

const favoriteFromLibrary = (library: LibraryEntry[]): { title: FlowTitle; ambient: string | null } | null => {
  const [entry] = library
    .filter((item) => item.inFavoritas && item.watched && item.rating === 10)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!entry) {
    return null;
  }
  return {
    title: {
      tmdbId: entry.tmdbId,
      kind: entry.kind,
      name: entry.name,
      year: entry.year,
      posterPath: entry.posterPath,
      titleId: entry.titleId,
      createdByFlow: false,
    },
    ambient: entry.posterAmbient,
  };
};

const queueFromLibrary = (library: LibraryEntry[]): FlowTitle[] =>
  library
    .filter((item) => item.inWatchlist && !item.watched)
    .map((item) => ({
      tmdbId: item.tmdbId,
      kind: item.kind,
      name: item.name,
      year: item.year,
      posterPath: item.posterPath,
      titleId: item.titleId,
      createdByFlow: false,
    }));

export const OnboardingFlow = ({
  mode,
  initialStep,
  userName,
  yearGridPromise,
  platforms: initialPlatforms,
  nightEnds: initialNightEnds,
  library,
  tmdbConfigured,
  resync,
}: OnboardingFlowProps) => {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<OnboardingStepId>(initialStep);
  const announcement = stepAnnouncement(step);

  const initialFavorite = favoriteFromLibrary(library);
  const [favorite, setFavorite] = useState<FlowTitle | null>(initialFavorite?.title ?? null);
  const [ambient, setAmbient] = useState<string | null>(initialFavorite?.ambient ?? null);
  const [ambientPoster, setAmbientPoster] = useState<string | null>(initialFavorite?.title.posterPath ?? null);

  const [yearSelection, setYearSelection] = useState<YearGridSelection | null>(null);
  const [yearRefs, setYearRefs] = useState<Map<number, YearTitleRef>>(new Map());
  const [extraYearItems, setExtraYearItems] = useState<YearGridItem[]>([]);

  const platformsState = useStickyOptimistic(initialPlatforms, sameIdList);
  const libraryTmdbIds = library.map((entry) => entry.tmdbId);
  const [queue, setQueue] = useState<FlowTitle[]>(() => queueFromLibrary(library));
  const updateQueue = (update: (current: FlowTitle[]) => FlowTitle[]) => setQueue(update);
  const [suggestions, setSuggestions] = useState<SuggestionItem[] | null>(null);
  const [nightEnds, setNightEnds] = useState<NightEnds>(initialNightEnds);
  const [payoff, setPayoff] = useState<PayoffPayload | null>(null);
  const [isFinishing, startFinish] = useTransition();

  useKeyboardInset(SEARCH_STEPS.includes(step));

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
      headingRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const go = (to: OnboardingStepId) => {
    const direction = stepDirection(step, to);
    startTransition(() => {
      addTransitionType(`bienvenida-${direction}`);
      setStep(to);
    });
    if (mode === "gated") {
      void saveOnboardingStep(to).catch(() => null);
    }
  };

  const finish = () => {
    startFinish(async () => {
      try {
        await finishOnboarding();
      } catch {
        // The gate stays; the proxy will bring them back here on the next request.
      }
      router.push("/");
      router.refresh();
    });
  };

  const skipAll = () => {
    if (mode === "rerun") {
      router.push("/perfil");
      return;
    }
    finish();
  };

  const setPlatforms = (next: Platform[]) => {
    const formData = new FormData();
    next.forEach((platform) => formData.append("platforms", platform));
    platformsState.run(next, () => updateStreamingPlatforms(formData));
    // Suggestions depend on the platform set: refetch on the next visit to that step.
    setSuggestions(null);
  };

  const answered: Record<OnboardingStepId, boolean> = {
    intro: true,
    favorita: favorite != null,
    anio: (yearSelection?.seen.size ?? 0) > 0,
    plataformas: platformsState.value.length > 0,
    "quiero-ver": queue.length > 0,
    noche: true,
    "primera-noche": true,
  };

  const next = nextStep(step);
  const previous = prevStep(step);

  const primaryLabel =
    step === "intro"
      ? "Empezar"
      : step === "primera-noche"
        ? "Entrar a Filmia"
        : step === "noche"
          ? "Listo"
          : answered[step]
            ? "Siguiente"
            : "Saltar";

  const onPrimary = () => {
    if (step === "primera-noche") {
      finish();
      return;
    }
    if (next) {
      go(next);
    }
  };

  const content = (() => {
    switch (step) {
      case "intro":
        return <IntroStep userName={userName} headingRef={headingRef} />;
      case "favorita":
        return (
          <FavoriteStep
            favorite={favorite}
            tmdbConfigured={tmdbConfigured}
            headingRef={headingRef}
            onFavorite={(title, nextAmbient) => {
              setFavorite(title);
              if (title) {
                setAmbientPoster(title.posterPath);
              }
              if (nextAmbient) {
                setAmbient(nextAmbient);
              }
            }}
          />
        );
      case "anio":
        return (
          <YearStep
            yearGridPromise={yearGridPromise}
            extraItems={extraYearItems}
            onExtraItem={(item) => setExtraYearItems((current) => (current.some((entry) => entry.tmdbId === item.tmdbId) ? current : [...current, item]))}
            selection={yearSelection}
            onSelection={setYearSelection}
            titleRefs={yearRefs}
            onTitleRefs={setYearRefs}
            library={library}
            tmdbConfigured={tmdbConfigured}
            headingRef={headingRef}
          />
        );
      case "plataformas":
        return (
          <PlatformsStep
            value={platformsState.value}
            onChange={setPlatforms}
            isPending={platformsState.isPending}
            error={platformsState.error}
            headingRef={headingRef}
          />
        );
      case "quiero-ver":
        return (
          <WatchlistStep
            platforms={platformsState.value}
            libraryTmdbIds={libraryTmdbIds}
            queue={queue}
            onQueue={updateQueue}
            suggestions={suggestions}
            onSuggestions={setSuggestions}
            tmdbConfigured={tmdbConfigured}
            headingRef={headingRef}
          />
        );
      case "noche":
        return <BedtimeStep value={nightEnds} onChange={setNightEnds} headingRef={headingRef} />;
      case "primera-noche":
        return (
          <PayoffStep
            payload={payoff}
            onPayload={setPayoff}
            headingRef={headingRef}
            onAmbient={(nextAmbient, posterPath) => {
              if (nextAmbient) {
                setAmbient(nextAmbient);
              }
              if (posterPath) {
                setAmbientPoster(posterPath);
              }
            }}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div className="bienvenida-shell relative isolate flex min-h-[100dvh] flex-col">
      {resync ? <SessionResync /> : null}
      <AmbientBackdrop ambient={ambient} posterPath={ambientPoster} />

      <header className="bienvenida-chrome-top sticky top-0 z-20 px-5 pt-[calc(0.9rem+env(safe-area-inset-top))] pb-3">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4">
          <FilmStripProgress step={step} />
          {step !== "intro" && step !== "primera-noche" ? (
            <button type="button" onClick={skipAll} className={cn(btnLink, "text-mist")}>
              {mode === "rerun" ? "Volver a Perfil" : "Saltar por ahora"}
            </button>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-8">
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
        <ViewTransition key={step} default="none" enter={TRANSITION_TYPES} exit={TRANSITION_TYPES}>
          <div className="bienvenida-step flex flex-1 flex-col">{content}</div>
        </ViewTransition>
      </main>

      <footer
        className="bienvenida-chrome-bottom bienvenida-actions sticky bottom-0 z-20 px-5 pt-3 pb-[calc(max(1rem,env(safe-area-inset-bottom))+var(--keyboard-inset,0px))]"
      >
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          {previous && step !== "primera-noche" ? (
            <Button variant="ghost" size="lg" onClick={() => go(previous)} aria-label="Paso anterior" className="px-4">
              Atrás
            </Button>
          ) : null}
          <Button
            size="lg"
            className={cn("flex-1 shadow-[0_12px_30px_-12px_rgb(var(--accent-rgb)/0.8)]", step === "intro" && "bienvenida-cta-pulse")}
            onClick={onPrimary}
            pending={isFinishing}
            pendingLabel="Abriendo tu sala…"
          >
            {primaryLabel}
          </Button>
        </div>
        {step === "intro" ? (
          <div className="mx-auto mt-3 flex w-full max-w-xl items-center justify-center gap-4 text-xs">
            <button type="button" onClick={skipAll} className={cn(btnLink, "text-mist")}>
              {mode === "rerun" ? "Volver a Perfil" : "Saltar por ahora"}
            </button>
            {mode === "gated" ? (
              <>
                <span className="text-faint" aria-hidden="true">
                  ·
                </span>
                <button type="button" onClick={() => void logoutUser()} className={cn("text-xs text-faint hover:text-paper", focusRing)}>
                  Salir
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </footer>
    </div>
  );
};
