"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { relinkTitle } from "@/app/actions/titles";
import { Button } from "@/components/Button";
import { PosterImage } from "@/components/PosterImage";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { useTmdbDiscoverSearch } from "@/components/tmdb-search/useTmdbDiscoverSearch";
import type { TitleKind } from "@/db";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import { relinkCandidates } from "@/lib/relink-core";
import { showToast } from "@/lib/toast";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { fieldClass, focusRing } from "@/lib/ui";

type RelinkTitleSheetProps = {
  titleId: string;
  titleName: string;
  /** Prefills the search: the original title usually finds the right match first. */
  searchName: string;
  kind: TitleKind;
  tmdbId: number | null;
  configuredTmdb: boolean;
};

/**
 * «¿No es esta?»: when the entry points at the wrong film, pick the right TMDB
 * match. Only the link changes; nota, comentario, fecha y listas se quedan.
 */
export const RelinkTitleSheet = ({
  titleId,
  titleName,
  searchName,
  kind,
  tmdbId,
  configuredTmdb,
}: RelinkTitleSheetProps) => {
  const headingId = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!configuredTmdb) {
    return null;
  }

  return (
    <div className="flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "press-scale rounded-full px-3 py-1.5 text-sm text-mist underline-offset-4 hover:text-paper hover:underline",
          "transition-[color] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
          focusRing,
        )}
      >
        ¿No es {kind === "SERIES" ? "esta serie" : "esta película"}? Cambiar
      </button>
      {open ? (
        <RelinkSheetBody
          headingId={headingId}
          titleId={titleId}
          titleName={titleName}
          searchName={searchName}
          kind={kind}
          tmdbId={tmdbId}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
};

const RelinkSheetBody = ({
  headingId,
  titleId,
  titleName,
  searchName,
  kind,
  tmdbId,
  onClose,
  onDone,
}: Omit<RelinkTitleSheetProps, "configuredTmdb"> & {
  headingId: string;
  onClose: () => void;
  onDone: () => void;
}) => {
  const search = useTmdbDiscoverSearch({ enabled: true, initialQuery: searchName });
  const [selected, setSelected] = useState<TmdbCatalogResult | null>(null);
  const [error, setError] = useState<{ message: string; existingTitleId?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const candidates = useMemo(
    () => relinkCandidates(search.results, { kind, tmdbId }),
    [search.results, kind, tmdbId],
  );
  const kindLabel = TITLE_KIND_LABEL[kind].toLowerCase();

  const handleConfirm = () => {
    if (!selected) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await relinkTitle(titleId, {
        tmdbId: selected.tmdbId,
        kind: selected.kind,
        name: selected.name,
        originalName: selected.originalName,
        year: selected.year,
        posterPath: selected.posterPath,
      });
      if (!result.ok) {
        setError({ message: result.error, existingTitleId: result.existingTitleId });
        return;
      }
      showToast({
        title: result.changed ? "Ficha cambiada" : "Ya era esta",
        description: selected.year ? `${selected.name} (${selected.year})` : selected.name,
      });
      onDone();
    });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      labelledBy={headingId}
      overlayLabel="Cerrar cambiar ficha"
      dragDismiss
      portal
      panelClassName="max-h-[min(40rem,88dvh)]"
    >
      <div className="flex flex-col items-center px-5 pt-3">
        <SheetHandle className="sm:hidden" />
      </div>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-4">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
            ¿No es esta?
          </p>
          <h2 id={headingId} className="font-serif text-2xl text-paper">
            Elige la {kind === "SERIES" ? "serie" : "película"} correcta
          </h2>
          <p className="text-xs text-mist">
            Ahora: {titleName}. Tu nota, comentario, fecha y listas se quedan; solo cambia la ficha.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="press-scale h-9 w-9 shrink-0 px-0"
          aria-label="Cerrar"
        >
          <CloseIcon />
        </Button>
      </div>

      <div className="border-b border-line px-5 py-4" data-no-sheet-drag>
        <label className="block">
          <span className="sr-only">Buscar en TMDB</span>
          <input
            value={search.query}
            onChange={(event) => {
              setSelected(null);
              search.handleQueryChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                search.handleSearch();
              }
            }}
            placeholder="Título, título original…"
            className={fieldClass}
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
      </div>

      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4"
        data-no-sheet-drag
        aria-busy={search.isSearching}
      >
        {search.error ? (
          <p role="alert" className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger">
            {search.error}
          </p>
        ) : search.isSearching && candidates.length === 0 ? (
          <p className="text-sm text-mist">Buscando en TMDB…</p>
        ) : search.hasSearched && candidates.length === 0 ? (
          <p className="text-sm text-mist">Ningún otro resultado de tipo {kindLabel}. Prueba con el título original.</p>
        ) : (
          <ul className="space-y-2" role="listbox" aria-label="Resultados de TMDB">
            {candidates.map((result) => {
              const isSelected = selected?.tmdbId === result.tmdbId;
              return (
                <li key={`${result.kind}:${result.tmdbId}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setError(null);
                      setSelected(result);
                    }}
                    disabled={isPending}
                    className={cn(
                      "card-physics press-scale flex w-full items-center gap-3 rounded-2xl border bg-well px-3 py-2.5 text-left disabled:opacity-60",
                      "transition-[border-color,background-color,opacity] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
                      isSelected ? "border-accent" : "border-line hover:border-accent/40",
                      focusRing,
                    )}
                  >
                    <span className="w-12 shrink-0 overflow-hidden rounded-lg">
                      <PosterImage
                        name={result.name}
                        posterPath={result.posterPath}
                        sizes="48px"
                        className="rounded-lg"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-paper">{result.name}</span>
                      <span className="block truncate text-sm text-fog">
                        {[result.year, result.originalName !== result.name ? result.originalName : null]
                          .filter(Boolean)
                          .join(" · ") || TITLE_KIND_LABEL[result.kind]}
                      </span>
                    </span>
                    {isSelected ? (
                      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.12em] text-accent">
                        Elegida
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-line px-5 py-4" data-no-sheet-drag>
        {error ? (
          <p role="alert" className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger">
            {error.message}{" "}
            {error.existingTitleId ? (
              <Link href={`/titulos/${error.existingTitleId}`} className="underline underline-offset-4">
                Ir a esa ficha
              </Link>
            ) : null}
          </p>
        ) : null}
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!selected}
          pending={isPending}
          pendingLabel="Cambiando…"
          className="w-full py-3"
        >
          {selected ? `Cambiar a «${selected.name}»` : "Elige un resultado"}
        </Button>
      </div>
    </Sheet>
  );
};

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden="true"
  >
    <path strokeLinecap="round" d="M7 7l10 10M17 7 7 17" />
  </svg>
);
