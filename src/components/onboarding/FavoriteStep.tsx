"use client";

import { useState, useTransition, type RefObject } from "react";
import { pickAllTimeFavorite } from "@/app/actions/onboarding";
import { PosterImage } from "@/components/PosterImage";
import { OnboardingSearchField } from "@/components/onboarding/OnboardingSearchField";
import { PosterPickTile } from "@/components/onboarding/PosterPickTile";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { useOnboardingSearch } from "@/components/onboarding/useOnboardingSearch";
import type { FlowTitle } from "@/components/onboarding/types";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { showToast } from "@/lib/toast";
import { focusRing } from "@/lib/ui";

type FavoriteStepProps = {
  favorite: FlowTitle | null;
  onFavorite: (title: FlowTitle | null, ambient: string | null) => void;
  tmdbConfigured: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export const FavoriteStep = ({ favorite, onFavorite, tmdbConfigured, headingRef }: FavoriteStepProps) => {
  const search = useOnboardingSearch({ enabled: tmdbConfigured });
  const [changing, setChanging] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const choose = (result: TmdbCatalogResult) => {
    const previous = favorite?.titleId ? { titleId: favorite.titleId, createdByFlow: favorite.createdByFlow } : null;
    const optimistic: FlowTitle = {
      tmdbId: result.tmdbId,
      kind: result.kind,
      name: result.name,
      originalName: result.originalName,
      year: result.year,
      posterPath: result.posterPath,
      titleId: null,
      createdByFlow: true,
    };
    setPendingKey(`${result.kind}:${result.tmdbId}`);
    onFavorite(optimistic, null);
    setChanging(false);
    search.clear();
    startSave(async () => {
      const outcome = await pickAllTimeFavorite(
        {
          tmdbId: result.tmdbId,
          kind: result.kind,
          name: result.name,
          originalName: result.originalName,
          year: result.year,
          posterPath: result.posterPath,
        },
        previous,
      );
      setPendingKey(null);
      if (!outcome.ok) {
        onFavorite(favorite, null);
        showToast({ title: "No se pudo guardar", description: outcome.error, variant: "error" });
        return;
      }
      onFavorite({ ...optimistic, titleId: outcome.titleId, createdByFlow: outcome.created }, outcome.ambient);
    });
  };

  const showSearch = !favorite || changing;

  return (
    <div className="space-y-6">
      <StepHeader
        headingRef={headingRef}
        eyebrow="De todos los tiempos"
        title={
          <>
            Tu película <span className="text-accent">favorita</span>
          </>
        }
        lede="La que recomiendas sin pensarlo. Hoy la usará como brújula: «porque le diste 5★ a…»."
      />

      {favorite ? (
        <section
          key={`${favorite.kind}:${favorite.tmdbId}`}
          aria-label="Tu favorita"
          className="favorite-hero relative mx-auto flex w-full max-w-sm items-end gap-4 rounded-3xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl"
        >
          <div className="relative w-28 shrink-0 overflow-hidden rounded-poster shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
            <PosterImage name={favorite.name} posterPath={favorite.posterPath} priority sizes="112px" />
            <span className="visto-stamp" aria-hidden="true" style={{ fontSize: 16, padding: "4px 9px", borderWidth: 2 }}>
              Visto
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 pb-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Tu favorita</p>
            <h2 className="font-serif text-xl leading-tight text-paper">{favorite.name}</h2>
            <p className="text-sm text-fog">
              {[favorite.year, TITLE_KIND_LABEL[favorite.kind]].filter(Boolean).join(" · ")}
            </p>
            <p className="favorite-stars text-star" aria-label="Cinco estrellas">
              {"★★★★★".split("").map((star, index) => (
                <span key={index} style={{ animationDelay: `${120 + index * 70}ms` }}>
                  {star}
                </span>
              ))}
            </p>
            <p className="text-xs text-mist" aria-live="polite">
              {isSaving && pendingKey ? "Guardando…" : "Guardada en Favoritas."}
            </p>
            <button
              type="button"
              onClick={() => setChanging((value) => !value)}
              className={cn("text-xs font-medium text-accent underline-offset-2 hover:underline", focusRing)}
            >
              {changing ? "Dejarla así" : "Cambiarla"}
            </button>
          </div>
        </section>
      ) : null}

      {showSearch ? (
        <div className="space-y-4">
          {tmdbConfigured ? (
            <OnboardingSearchField
              value={search.query}
              onChange={search.onQueryChange}
              onSubmit={search.submit}
              label="Buscar tu película favorita"
              placeholder="Interestelar, Amélie, El Padrino…"
              autoFocus={!favorite}
            />
          ) : (
            <p className="rounded-2xl border border-line bg-surface/60 px-4 py-3 text-sm text-fog">
              La búsqueda no está disponible ahora. Puedes saltar este paso y añadirla después desde Buscar.
            </p>
          )}

          {search.error ? (
            <p role="alert" className="text-sm text-danger">
              {search.error}
            </p>
          ) : null}

          {search.results.length > 0 ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Resultados">
              {search.results.slice(0, 12).map((result, index) => {
                const key = `${result.kind}:${result.tmdbId}`;
                return (
                  <PosterPickTile
                    key={key}
                    index={index}
                    name={result.name}
                    posterPath={result.posterPath}
                    year={result.year}
                    caption={[result.year, result.kind === "SERIES" ? "Serie" : null].filter(Boolean).join(" · ") || null}
                    state={pendingKey === key ? "pending" : "none"}
                    onClick={() => choose(result)}
                    ariaLabel={`Elegir ${result.name}${result.year ? ` (${result.year})` : ""} como tu favorita`}
                  />
                );
              })}
            </ul>
          ) : search.hasSearched && !search.isSearching ? (
            <p className="text-sm text-mist">Nada con ese nombre. Prueba con el título original.</p>
          ) : search.isSearching ? (
            <p className="text-sm text-mist" aria-live="polite">
              Buscando…
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
