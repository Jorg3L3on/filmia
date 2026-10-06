"use client";

import { useEffect, useState, useTransition, type RefObject } from "react";
import { addWatchlistPick, getOnboardingSuggestions, removeWatchlistPick } from "@/app/actions/onboarding";
import { ShimmerBlock } from "@/components/PageSkeletons";
import { PlatformLogo } from "@/components/PlatformLogo";
import { OnboardingSearchField } from "@/components/onboarding/OnboardingSearchField";
import { PosterPickTile } from "@/components/onboarding/PosterPickTile";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { flowTitleKey, type FlowTitle } from "@/components/onboarding/types";
import { useOnboardingSearch } from "@/components/onboarding/useOnboardingSearch";
import type { Platform } from "@/db";
import type { SuggestionItem } from "@/lib/onboarding/load";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { showToast } from "@/lib/toast";

type WatchlistStepProps = {
  platforms: Platform[];
  /** Everything already in the library (watched or queued): never suggest it again. */
  libraryTmdbIds: number[];
  queue: FlowTitle[];
  onQueue: (update: (current: FlowTitle[]) => FlowTitle[]) => void;
  suggestions: SuggestionItem[] | null;
  onSuggestions: (items: SuggestionItem[]) => void;
  tmdbConfigured: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

type Candidate = {
  tmdbId: number;
  kind: "MOVIE" | "SERIES";
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  platform?: Platform | null;
};

export const WatchlistStep = ({
  platforms,
  libraryTmdbIds,
  queue,
  onQueue,
  suggestions,
  onSuggestions,
  tmdbConfigured,
  headingRef,
}: WatchlistStepProps) => {
  const search = useOnboardingSearch({ enabled: tmdbConfigured });
  const [isLoading, startLoad] = useTransition();
  const [, startSave] = useTransition();
  const [pending, setPending] = useState<Set<string>>(new Set());
  const excludeKey = [...new Set([...libraryTmdbIds, ...queue.map((title) => title.tmdbId)])].join(",");

  useEffect(() => {
    if (suggestions || !tmdbConfigured || platforms.length === 0) {
      return;
    }
    const exclude = excludeKey ? excludeKey.split(",").map(Number) : [];
    startLoad(async () => {
      const items = await getOnboardingSuggestions(exclude).catch(() => []);
      onSuggestions(items);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per visit; the queue only seeds the exclusion
  }, [suggestions, tmdbConfigured, platforms.length]);

  const queued = new Map(queue.map((title) => [flowTitleKey(title), title]));

  const toggle = (candidate: Candidate) => {
    const key = flowTitleKey(candidate);
    const existing = queued.get(key);
    const nextPending = new Set(pending);
    nextPending.add(key);
    setPending(nextPending);

    if (existing) {
      onQueue((current) => current.filter((title) => flowTitleKey(title) !== key));
      startSave(async () => {
        if (existing.titleId) {
          await removeWatchlistPick(existing.titleId, existing.createdByFlow).catch(() => {
            onQueue((current) => [...current, existing]);
            showToast({ title: "No se pudo quitar", variant: "error" });
          });
        }
        setPending((current) => {
          const copy = new Set(current);
          copy.delete(key);
          return copy;
        });
      });
      return;
    }

    const optimistic: FlowTitle = { ...candidate, titleId: null, createdByFlow: true, platform: candidate.platform ?? null };
    onQueue((current) => [...current, optimistic]);
    startSave(async () => {
      const outcome = await addWatchlistPick({
        tmdbId: candidate.tmdbId,
        kind: candidate.kind,
        name: candidate.name,
        originalName: candidate.originalName,
        year: candidate.year,
        posterPath: candidate.posterPath,
      });
      setPending((current) => {
        const copy = new Set(current);
        copy.delete(key);
        return copy;
      });
      if (!outcome.ok) {
        onQueue((current) => current.filter((title) => flowTitleKey(title) !== key));
        showToast({ title: "No se pudo guardar", description: outcome.error, variant: "error" });
        return;
      }
      onQueue((current) =>
        current.map((title) =>
          flowTitleKey(title) === key ? { ...title, titleId: outcome.titleId, createdByFlow: outcome.created } : title,
        ),
      );
    });
  };

  const tileState = (candidate: Candidate) => {
    const key = flowTitleKey(candidate);
    if (pending.has(key)) {
      return "pending" as const;
    }
    return queued.has(key) ? ("selected" as const) : ("none" as const);
  };

  const label = (candidate: Candidate) =>
    queued.has(flowTitleKey(candidate))
      ? `Quitar ${candidate.name} de Quiero ver`
      : `Añadir ${candidate.name}${candidate.year ? ` (${candidate.year})` : ""} a Quiero ver`;

  return (
    <div className="space-y-6">
      <StepHeader
        headingRef={headingRef}
        eyebrow="Quiero ver"
        title={
          <>
            ¿Qué quieres <span className="text-accent">ver</span>?
          </>
        }
        lede={
          platforms.length > 0
            ? "Lo que está incluido en tus plataformas ahora mismo. Toca para guardar en Quiero ver."
            : "Busca lo que tienes pendiente y guárdalo en Quiero ver."
        }
      />

      <div className="flex items-center justify-between gap-3">
        <p className="queue-counter text-sm font-semibold text-paper" aria-live="polite" aria-atomic="true">
          <span key={queue.length} className="queue-counter-num inline-block text-accent">
            {queue.length}
          </span>{" "}
          en Quiero ver
        </p>
        <p className="text-xs text-mist">Con 3 o más, Hoy tiene de dónde elegir.</p>
      </div>

      {tmdbConfigured ? (
        <OnboardingSearchField
          value={search.query}
          onChange={search.onQueryChange}
          onSubmit={search.submit}
          label="Buscar títulos para Quiero ver"
          placeholder="Busca una peli o serie…"
        />
      ) : null}

      {search.results.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-fog">Resultados</h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {search.results.slice(0, 8).map((result, index) => (
              <PosterPickTile
                key={`${result.kind}:${result.tmdbId}`}
                index={index}
                name={result.name}
                posterPath={result.posterPath}
                year={result.year}
                caption={[result.year, result.kind === "SERIES" ? "Serie" : null].filter(Boolean).join(" · ") || null}
                state={tileState(result)}
                onClick={() => toggle(result)}
                ariaLabel={label(result)}
              />
            ))}
          </ul>
        </section>
      ) : search.hasSearched && !search.isSearching ? (
        <p className="text-sm text-mist">Nada con ese nombre.</p>
      ) : null}

      {platforms.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-fog">
            {isLoading || !suggestions ? "Buscando en tus plataformas…" : "Populares en tus plataformas"}
          </h2>
          {!suggestions ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <li key={index}>
                  <ShimmerBlock className="aspect-[2/3] w-full rounded-poster" />
                </li>
              ))}
            </ul>
          ) : suggestions.length > 0 ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Populares en tus plataformas">
              {suggestions.map((item, index) => (
                <PosterPickTile
                  key={`${item.kind}:${item.tmdbId}`}
                  index={index}
                  priority={index < 3}
                  name={item.name}
                  posterPath={item.posterPath}
                  year={item.year}
                  caption={[item.year, item.kind === "SERIES" ? "Serie" : null].filter(Boolean).join(" · ") || null}
                  state={tileState(item)}
                  badge={
                    item.platform ? (
                      <span title={PLATFORM_SERVICE_LABEL[item.platform]}>
                        <PlatformLogo platform={item.platform} size={22} className="rounded-md shadow" />
                      </span>
                    ) : null
                  }
                  onClick={() => toggle(item)}
                  ariaLabel={label(item)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mist">No encontramos sugerencias ahora. Usa el buscador.</p>
          )}
        </section>
      ) : null}
    </div>
  );
};
