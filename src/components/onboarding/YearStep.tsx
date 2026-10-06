"use client";

import { Suspense, use, useEffect, useState, useTransition, type RefObject } from "react";
import { applyYearPicks } from "@/app/actions/onboarding";
import { ImdbBadge } from "@/components/ImdbBadge";
import { ShimmerBlock } from "@/components/PageSkeletons";
import { OnboardingSearchField } from "@/components/onboarding/OnboardingSearchField";
import { PosterPickTile } from "@/components/onboarding/PosterPickTile";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { useOnboardingSearch } from "@/components/onboarding/useOnboardingSearch";
import type { LibraryEntry, YearGrid, YearGridItem } from "@/lib/onboarding/load";
import {
  YEAR_PICK_LABEL,
  YEAR_PICK_NEXT_ACTION,
  cycleYearPick,
  selectionFromLibrary,
  yearPickStateOf,
  type YearGridSelection,
} from "@/lib/onboarding/year-grid";
import { showToast } from "@/lib/toast";

export type YearTitleRef = { titleId: string | null; createdByFlow: boolean };

type YearStepProps = {
  yearGridPromise: Promise<YearGrid>;
  extraItems: YearGridItem[];
  onExtraItem: (item: YearGridItem) => void;
  selection: YearGridSelection | null;
  onSelection: (selection: YearGridSelection) => void;
  titleRefs: Map<number, YearTitleRef>;
  onTitleRefs: (refs: Map<number, YearTitleRef>) => void;
  library: LibraryEntry[];
  tmdbConfigured: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export const YearStep = (props: YearStepProps) => (
  <Suspense fallback={<YearStepSkeleton headingRef={props.headingRef} />}>
    <YearStepBody {...props} />
  </Suspense>
);

const YearStepBody = ({
  yearGridPromise,
  extraItems,
  onExtraItem,
  selection,
  onSelection,
  titleRefs,
  onTitleRefs,
  library,
  tmdbConfigured,
  headingRef,
}: YearStepProps) => {
  const grid = use(yearGridPromise);
  const items = [...grid.items, ...extraItems.filter((extra) => !grid.items.some((item) => item.tmdbId === extra.tmdbId))];
  const search = useOnboardingSearch({ enabled: tmdbConfigured, year: grid.year, kind: "MOVIE" });
  const [, startSave] = useTransition();
  const [announcement, setAnnouncement] = useState("");

  // Resume: what the library already says about these titles (watched / 5★).
  useEffect(() => {
    if (selection) {
      return;
    }
    const ids = items.map((item) => item.tmdbId);
    onSelection(selectionFromLibrary(library, ids));
    const refs = new Map<number, YearTitleRef>();
    for (const entry of library) {
      if (ids.includes(entry.tmdbId)) {
        refs.set(entry.tmdbId, { titleId: entry.titleId, createdByFlow: false });
      }
    }
    onTitleRefs(refs);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when the grid resolves
  }, [grid.year]);

  const current = selection ?? { seen: new Set<number>(), favoriteTmdbId: null };

  const tap = (item: YearGridItem) => {
    const { selection: next, changes } = cycleYearPick(current, item.tmdbId);
    onSelection(next);
    const state = yearPickStateOf(next, item.tmdbId);
    setAnnouncement(`${item.name}: ${YEAR_PICK_LABEL[state]}.`);
    const byId = new Map(items.map((entry) => [entry.tmdbId, entry]));
    startSave(async () => {
      const outcomes = await applyYearPicks(
        changes.map((change) => {
          const source = byId.get(change.tmdbId) ?? item;
          const ref = titleRefs.get(change.tmdbId);
          return {
            tmdbId: source.tmdbId,
            kind: source.kind,
            name: source.name,
            originalName: source.originalName,
            year: source.year,
            posterPath: source.posterPath,
            to: change.to,
            titleId: ref?.titleId ?? null,
            createdByFlow: ref?.createdByFlow ?? false,
          };
        }),
      ).catch(() => null);
      if (!outcomes) {
        onSelection(current);
        showToast({ title: "No se pudo guardar", variant: "error" });
        return;
      }
      const refs = new Map(titleRefs);
      for (const outcome of outcomes) {
        if (outcome.titleId) {
          const previous = refs.get(outcome.tmdbId);
          refs.set(outcome.tmdbId, {
            titleId: outcome.titleId,
            createdByFlow: outcome.created || (previous?.createdByFlow ?? false),
          });
        } else {
          refs.delete(outcome.tmdbId);
        }
      }
      onTitleRefs(refs);
    });
  };

  const addFromSearch = (result: { tmdbId: number; kind: "MOVIE" | "SERIES"; name: string; originalName: string | null; year: number | null; posterPath: string | null }) => {
    const item: YearGridItem = {
      tmdbId: result.tmdbId,
      kind: result.kind,
      name: result.name,
      originalName: result.originalName,
      year: result.year,
      posterPath: result.posterPath,
      imdbRating: null,
      voteAverage: null,
      voteCount: 0,
    };
    onExtraItem(item);
    search.clear();
    if (yearPickStateOf(current, item.tmdbId) === "none") {
      tap(item);
    }
  };

  const seenCount = current.seen.size;

  return (
    <div className="space-y-6">
      <StepHeader
        headingRef={headingRef}
        eyebrow={`Este año · ${grid.year}`}
        title={
          <>
            Lo mejor de <span className="text-accent">{grid.year}</span>
          </>
        }
        lede="Toca las que ya viste. Vuelve a tocar una para coronarla como tu favorita del año."
      />

      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-fog" aria-live="polite">
          {seenCount === 0
            ? "Nada marcado todavía."
            : `${seenCount} ${seenCount === 1 ? "vista" : "vistas"}${current.favoriteTmdbId != null ? " · 1 favorita" : ""}`}
        </p>
        <Legend />
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {items.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label={`Películas populares de ${grid.year}`}>
          {items.map((item, index) => {
            const state = yearPickStateOf(current, item.tmdbId);
            return (
              <PosterPickTile
                key={item.tmdbId}
                index={index}
                name={item.name}
                posterPath={item.posterPath}
                year={item.year}
                priority={index < 3}
                state={state}
                badge={
                  item.imdbRating != null ? (
                    <ImdbBadge rating={item.imdbRating} compact />
                  ) : item.voteAverage != null ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-star" title={`TMDB ${item.voteAverage.toFixed(1)}/10`}>
                      <span aria-hidden="true">★</span>
                      {item.voteAverage.toFixed(1)}
                    </span>
                  ) : null
                }
                onClick={() => tap(item)}
                ariaLabel={`${item.name}: ${YEAR_PICK_LABEL[state]}. Toca para ${YEAR_PICK_NEXT_ACTION[state]}.`}
              />
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-line bg-surface/60 px-4 py-3 text-sm text-fog">
          No pudimos cargar los estrenos. Busca una abajo o salta este paso.
        </p>
      )}

      {tmdbConfigured ? (
        <div className="space-y-3">
          <OnboardingSearchField
            value={search.query}
            onChange={search.onQueryChange}
            onSubmit={search.submit}
            label={`Buscar otra película de ${grid.year}`}
            placeholder={`¿Otra de ${grid.year}? Búscala…`}
          />
          {search.results.length > 0 ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Resultados">
              {search.results.slice(0, 8).map((result, index) => (
                <PosterPickTile
                  key={`${result.kind}:${result.tmdbId}`}
                  index={index}
                  name={result.name}
                  posterPath={result.posterPath}
                  year={result.year}
                  state={yearPickStateOf(current, result.tmdbId)}
                  onClick={() => addFromSearch(result)}
                  ariaLabel={`Añadir ${result.name} como vista`}
                />
              ))}
            </ul>
          ) : search.hasSearched && !search.isSearching ? (
            <p className="text-sm text-mist">Nada de {grid.year} con ese nombre.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const Legend = () => (
  <ul className="flex items-center gap-3 text-[11px] text-mist" aria-hidden="true">
    <li className="flex items-center gap-1">
      <span className="inline-block rounded-[3px] border border-success px-1 font-serif text-[9px] font-bold uppercase tracking-wider text-success">
        Visto
      </span>
      1 toque
    </li>
    <li className="flex items-center gap-1">
      <span className="inline-flex size-4 items-center justify-center rounded-full bg-star text-[9px] text-ink">♛</span>
      2 toques
    </li>
  </ul>
);

const YearStepSkeleton = ({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) => (
  <div className="space-y-6" aria-busy="true">
    <StepHeader headingRef={headingRef} eyebrow="Este año" title="Lo mejor del año" lede="Buscando los estrenos más vistos…" />
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {Array.from({ length: 9 }, (_, index) => (
        <li key={index}>
          <ShimmerBlock className="aspect-[2/3] w-full rounded-poster" />
        </li>
      ))}
    </ul>
  </div>
);
