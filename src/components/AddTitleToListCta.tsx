"use client";

import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import { addTitleFromTmdbToList } from "@/app/actions/lists";
import { Button } from "@/components/Button";
import { PosterImage } from "@/components/PosterImage";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { useTmdbDiscoverSearch } from "@/components/tmdb-search/useTmdbDiscoverSearch";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import {
  mergeListAddCandidates,
  type LocalListTitle,
  type TmdbListCandidate,
} from "@/lib/list-add-candidates";
import { showToast } from "@/lib/toast";
import { actionErrorMessage } from "@/lib/use-optimistic-action";
import { fieldClass, focusRing, pillActionClass } from "@/lib/ui";
import { SegmentPlusIcon } from "@/components/SegmentAction";

export type AddableListTitle = LocalListTitle;

type AddTitleToListCtaProps = {
  /** Bound server action that adds one title to the collection. */
  action: (titleId: string) => Promise<void>;
  titles: AddableListTitle[];
  /** With a list id and TMDB configured, TMDB results show inline (same search as Buscar). */
  listId?: string;
  configuredTmdb?: boolean;
  /** `kind:tmdbId` keys of titles already on the list. */
  inListKeys?: string[];
  compact?: boolean;
};

export const AddTitleToListCta = ({
  action,
  titles,
  listId,
  configuredTmdb = false,
  inListKeys = [],
  compact = false,
}: AddTitleToListCtaProps) => {
  const titleId = useId();
  const tmdbEnabled = configuredTmdb && Boolean(listId);
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const search = useTmdbDiscoverSearch({ enabled: tmdbEnabled });
  const { query } = search;
  const trimmedQuery = query.trim();

  const inListSet = useMemo(() => new Set(inListKeys), [inListKeys]);
  const candidates = useMemo(
    () =>
      mergeListAddCandidates({
        local: titles,
        query,
        tmdbResults: tmdbEnabled ? search.results : [],
        inListKeys: inListSet,
        addedKeys,
      }),
    [addedKeys, inListSet, query, search.results, titles, tmdbEnabled],
  );
  const filtered = candidates.local;
  const showTmdb = tmdbEnabled && Boolean(trimmedQuery);
  const tmdbBusy = showTmdb && (search.isSearching || !search.hasSearched);
  const tmdbError = showTmdb ? search.error : null;
  const nothingFound =
    filtered.length === 0 && candidates.tmdb.length === 0 && !tmdbBusy && !tmdbError;

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    search.reset();
    setPendingId(null);
  };

  const markAdded = (keys: string[], added: boolean) => {
    setAddedKeys((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (added) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  };

  /** Optimistic like before: close, toast, write; on failure roll back and reopen. */
  const runAdd = (keys: string[], name: string, write: () => Promise<void>) => {
    setError(null);
    markAdded(keys, true);
    setPendingId(keys[0]);
    handleClose();
    showToast({ title: "En la lista", description: name });
    startTransition(async () => {
      try {
        await write();
      } catch (caught) {
        markAdded(keys, false);
        setPendingId(null);
        setOpen(true);
        const message = actionErrorMessage(caught, "No se pudo agregar el título.");
        setError(message);
        showToast({ title: "No se pudo agregar", description: message, variant: "error" });
      }
    });
  };

  const handleAdd = (title: AddableListTitle) => {
    runAdd([title.id], title.name, () => action(title.id));
  };

  const handleAddTmdb = ({ key, result, state, titleId: localId }: TmdbListCandidate) => {
    if (state === "in-list") {
      return;
    }

    if (state === "local" && localId) {
      runAdd([key, localId], result.name, () => action(localId));
      return;
    }

    if (!listId) {
      return;
    }

    runAdd([key], result.name, async () => {
      const outcome = await addTitleFromTmdbToList(listId, {
        tmdbId: result.tmdbId,
        kind: result.kind,
        name: result.name,
        originalName: result.originalName,
        year: result.year,
        posterPath: result.posterPath,
      });
      if (!outcome.ok) {
        throw new Error(outcome.error);
      }
    });
  };

  const buscarHref = trimmedQuery
    ? `/buscar?q=${encodeURIComponent(trimmedQuery)}`
    : "/buscar";

  const buscarLink = (label: string) => (
    <>
      <Link
        href={buscarHref}
        className={`text-accent underline-offset-2 hover:underline ${focusRing}`}
        onClick={handleClose}
      >
        {label}
      </Link>
      .
    </>
  );

  return (
    <div className={compact ? undefined : "flex justify-center"}>
      {compact ? (
        <button
          type="button"
          onClick={handleOpen}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Agregar título a la lista"
          className={pillActionClass.primary}
        >
          <SegmentPlusIcon className="size-4 group-hover:rotate-90" />
          Agregar
        </button>
      ) : (
        <Button
          type="button"
          size="lg"
          onClick={handleOpen}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Agregar título a la lista"
          className="press-scale min-w-[min(100%,20rem)] transition-[filter,opacity] duration-[var(--duration-hover)] ease-[var(--ease-out)]"
        >
          + Agregar título
        </Button>
      )}

      <Sheet
        open={open}
        onClose={handleClose}
        labelledBy={titleId}
        overlayLabel="Cerrar agregar título"
        dragDismiss
        portal
        panelClassName="max-h-[min(40rem,88dvh)]"
      >
        <div className="flex flex-col items-center px-5 pt-3">
          <SheetHandle className="sm:hidden" />
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
              Lista
            </p>
            <h2 id={titleId} className="font-serif text-2xl text-paper">
              Agregar título
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="press-scale h-9 w-9 shrink-0 px-0"
            aria-label="Cerrar"
          >
            <CloseIcon />
          </Button>
        </div>

        <div className="space-y-3 border-b border-line px-5 py-4" data-no-sheet-drag>
          <label className="block">
            <span className="sr-only">
              {tmdbEnabled ? "Buscar en Filmia y en TMDB" : "Buscar en tu catálogo"}
            </span>
            <input
              value={query}
              onChange={(event) => search.handleQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && tmdbEnabled) {
                  event.preventDefault();
                  search.handleSearch();
                }
              }}
              placeholder="Interestelar, Dune, Severance…"
              className={fieldClass}
              autoComplete="off"
              enterKeyHint="search"
              autoFocus
            />
          </label>
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}
          <p className="text-xs text-mist">
            {tmdbEnabled ? (
              "Primero lo que ya está en Filmia; debajo, resultados de TMDB."
            ) : (
              <>
                Elige un título que ya esté en Filmia, o {buscarLink("búscalo en TMDB")}
              </>
            )}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4" data-no-sheet-drag>
          {filtered.length > 0 ? (
            <section className="space-y-2" aria-label="En Filmia">
              {showTmdb ? <SectionLabel>En Filmia</SectionLabel> : null}
              <ul className="space-y-2">
                {filtered.map((title) => (
                  <li key={title.id}>
                    <CandidateRow
                      name={title.name}
                      posterPath={title.posterPath}
                      meta={title.year ? String(title.year) : null}
                      actionLabel={isPending && pendingId === title.id ? "…" : "Agregar"}
                      disabled={isPending}
                      onClick={() => handleAdd(title)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {showTmdb && (candidates.tmdb.length > 0 || tmdbBusy || tmdbError) ? (
            <section className="space-y-2" aria-label="De TMDB" aria-busy={tmdbBusy}>
              <SectionLabel>De TMDB</SectionLabel>
              {tmdbError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
                >
                  {tmdbError}{" "}
                  <button
                    type="button"
                    onClick={search.handleSearch}
                    className={`text-accent underline-offset-2 hover:underline ${focusRing}`}
                  >
                    Reintentar
                  </button>
                </p>
              ) : null}
              {candidates.tmdb.length > 0 ? (
                <ul className="space-y-2">
                  {candidates.tmdb.map((candidate) => {
                    const { result } = candidate;
                    const inList = candidate.state === "in-list";
                    const meta = [result.year, TITLE_KIND_LABEL[result.kind]]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <li key={candidate.key}>
                        <CandidateRow
                          name={result.name}
                          posterPath={result.posterPath}
                          meta={meta}
                          actionLabel={
                            inList
                              ? "En la lista"
                              : isPending && pendingId === candidate.key
                                ? "…"
                                : "Agregar"
                          }
                          disabled={isPending || inList}
                          muted={inList}
                          onClick={() => handleAddTmdb(candidate)}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {tmdbBusy ? (
                <p className="text-sm text-mist" role="status">
                  Buscando en TMDB…
                </p>
              ) : null}
            </section>
          ) : null}

          {nothingFound && !trimmedQuery ? (
            <p className="text-sm text-fog">
              No hay más títulos en Filmia para esta lista.{" "}
              {tmdbEnabled
                ? "Escribe un nombre para buscarlo en TMDB."
                : buscarLink("Buscar en TMDB")}
            </p>
          ) : nothingFound ? (
            <p className="text-sm text-fog">
              Nada coincide con “{trimmedQuery}”.{" "}
              {tmdbEnabled
                ? "Prueba con el título original o un año."
                : buscarLink("Buscar en TMDB")}
            </p>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">{children}</p>
);

const CandidateRow = ({
  name,
  posterPath,
  meta,
  actionLabel,
  disabled,
  muted = false,
  onClick,
}: {
  name: string;
  posterPath: string | null;
  meta: string | null;
  actionLabel: string;
  disabled: boolean;
  muted?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={muted ? `${name} ya está en la lista` : `Agregar ${name} a la lista`}
    className={cn(
      "card-physics press-scale flex w-full items-center gap-3 rounded-2xl border border-line bg-well px-3 py-2.5 text-left disabled:opacity-60",
      "transition-[border-color,background-color,opacity] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
      "hover:border-accent/40",
      focusRing,
    )}
  >
    <span className="w-12 shrink-0 overflow-hidden rounded-lg">
      <PosterImage
        name={name}
        posterPath={posterPath}
        sizes="48px"
        className="rounded-lg transition-[filter] duration-[var(--duration-hover)]"
      />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium text-paper">{name}</span>
      {meta ? <span className="block truncate text-sm text-fog">{meta}</span> : null}
    </span>
    <span
      className={cn(
        "shrink-0 text-xs font-medium uppercase tracking-[0.12em]",
        muted ? "text-mist" : "text-accent",
      )}
    >
      {actionLabel}
    </span>
  </button>
);

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
