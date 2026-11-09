"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { addTitleFromTmdbToList, removeTitleFromList } from "@/app/actions/lists";
import { Button } from "@/components/Button";
import { PosterImage } from "@/components/PosterImage";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { useTmdbDiscoverSearch } from "@/components/tmdb-search/useTmdbDiscoverSearch";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import {
  LIST_ADD_PAGE_SIZE,
  mergeListAddCandidates,
  nextListAddPage,
  type LocalListTitle,
  type TmdbListCandidate,
} from "@/lib/list-add-candidates";
import { showToast } from "@/lib/toast";
import { retryAfterRevert, showActionError, TOAST_COPY, toastPoster } from "@/lib/toast-alerts";
import { actionErrorMessage } from "@/lib/use-optimistic-action";
import { fieldClass, focusRing, pillActionClass } from "@/lib/ui";
import {
  SegmentActionTooltip,
  SegmentPlusIcon,
  segmentActionCompactClass,
} from "@/components/SegmentAction";

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
  /** List header (FIL-I44-2): the one labelled accent action, «+ Agregar». */
  pill?: boolean;
};

const NO_KEYS: ReadonlySet<string> = new Set();

export const AddTitleToListCta = ({
  action,
  titles,
  listId,
  configuredTmdb = false,
  inListKeys = [],
  compact = false,
  pill = false,
}: AddTitleToListCtaProps) => {
  const titleId = useId();
  const tmdbEnabled = configuredTmdb && Boolean(listId);
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<ReadonlySet<string>>(() => new Set());
  // The rows as they were when the sheet opened (UX-12): an added title stays in its place as
  // «Añadida ✓» instead of vanishing when the list refreshes behind the sheet.
  const [shownTitles, setShownTitles] = useState(titles);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const search = useTmdbDiscoverSearch({ enabled: tmdbEnabled });
  const { query } = search;
  const trimmedQuery = query.trim();

  const inListSet = useMemo(() => new Set(inListKeys), [inListKeys]);
  const candidates = useMemo(
    () =>
      mergeListAddCandidates({
        local: shownTitles,
        query,
        tmdbResults: tmdbEnabled ? search.results : [],
        inListKeys: inListSet,
        addedKeys: NO_KEYS,
      }),
    [inListSet, query, search.results, shownTitles, tmdbEnabled],
  );
  const filtered = candidates.local;
  const showTmdb = tmdbEnabled && Boolean(trimmedQuery);
  const tmdbBusy = showTmdb && (search.isSearching || !search.hasSearched);
  const tmdbError = showTmdb ? search.error : null;
  const nothingFound =
    filtered.length === 0 && candidates.tmdb.length === 0 && !tmdbBusy && !tmdbError;

  // FIL-40: a page of rows at a time (the iPhone killed the page drawing ~500 posters at once).
  // A new query starts again from the first page; the filter itself still sees every title.
  const [rowLimit, setRowLimit] = useState(LIST_ADD_PAGE_SIZE);
  const [limitQuery, setLimitQuery] = useState(query);
  if (limitQuery !== query) {
    setLimitQuery(query);
    setRowLimit(LIST_ADD_PAGE_SIZE);
  }
  const visibleLocal = filtered.length > rowLimit ? filtered.slice(0, rowLimit) : filtered;
  const hasMoreLocal = filtered.length > visibleLocal.length;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [moreSentinel, setMoreSentinel] = useState<HTMLLIElement | null>(null);

  useEffect(() => {
    if (!moreSentinel || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRowLimit((current) => nextListAddPage(current, filtered.length));
        }
      },
      { root: scrollRef.current, rootMargin: "0px 0px 600px 0px" },
    );
    observer.observe(moreSentinel);
    return () => observer.disconnect();
    // rowLimit re-arms it: a sentinel still in view after a page only reports on a fresh observe.
  }, [filtered.length, moreSentinel, rowLimit]);

  // Touch: no keyboard on open (FIL-40). It rose while the sheet animated over the deck; the
  // search box is one tap away. A mouse keeps the cursor in the box as before.
  const [focusSearchOnOpen, setFocusSearchOnOpen] = useState(false);

  const handleOpen = () => {
    setShownTitles(titles);
    setAddedKeys(new Set());
    setRowLimit(LIST_ADD_PAGE_SIZE);
    setFocusSearchOnOpen(window.matchMedia("(pointer: fine)").matches);
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

  /**
   * The sheet stays open for the next title (UX-12): the row turns «Añadida ✓» where it is, the
   * toast confirms, and focus stays on that row (rows are never disabled while a write runs).
   */
  const runAdd = (keys: string[], name: string, write: () => Promise<void>, posterPath?: string | null) => {
    const poster = toastPoster(posterPath);
    const added = () => showToast({ title: TOAST_COPY.addedList, description: name, poster });
    setError(null);
    markAdded(keys, true);
    setPendingId(keys[0]);
    added();
    startTransition(async () => {
      try {
        await write();
      } catch (caught) {
        markAdded(keys, false);
        const message = actionErrorMessage(caught, "No se pudo agregar el título.");
        setError(message);
        const business = caught instanceof Error && caught.name === "ActionRejected";
        showActionError({
          title: TOAST_COPY.couldNotAdd,
          description: message,
          poster,
          retry: business
            ? undefined
            : async () => {
                await retryAfterRevert(
                  () => {
                    markAdded(keys, true);
                    setError(null);
                  },
                  () => markAdded(keys, false),
                  write,
                );
                added();
              },
        });
      } finally {
        setPendingId(null);
      }
    });
  };

  /** Tapping «Añadida ✓» on one of your titles takes it back off the list. */
  const runRemove = (keys: string[], name: string, removeId: string, posterPath?: string | null) => {
    if (!listId) {
      return;
    }
    const poster = toastPoster(posterPath);
    setError(null);
    markAdded(keys, false);
    showToast({ title: TOAST_COPY.removedList, description: name, poster });
    startTransition(async () => {
      try {
        await removeTitleFromList(listId, removeId);
      } catch (caught) {
        markAdded(keys, true);
        setError(actionErrorMessage(caught, "No se pudo quitar el título."));
      }
    });
  };

  const handleAdd = (title: AddableListTitle) => {
    if (addedKeys.has(title.id)) {
      runRemove([title.id], title.name, title.id, title.posterPath);
      return;
    }
    runAdd([title.id], title.name, () => action(title.id), title.posterPath);
  };

  const handleAddTmdb = ({ key, result, state, titleId: localId }: TmdbListCandidate) => {
    if (state === "in-list" || addedKeys.has(key)) {
      if (state === "local" && localId && addedKeys.has(key)) {
        runRemove([key, localId], result.name, localId, result.posterPath);
      }
      return;
    }

    if (state === "local" && localId) {
      runAdd([key, localId], result.name, () => action(localId), result.posterPath);
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
        const rejected = new Error(outcome.error);
        rejected.name = "ActionRejected";
        throw rejected;
      }
    }, result.posterPath);
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
    <div className={compact || pill ? undefined : "flex justify-center"}>
      {pill ? (
        <button
          type="button"
          onClick={handleOpen}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Agregar título a la lista"
          className={cn(pillActionClass.primary, "pl-3.5 pr-5")}
        >
          <SegmentPlusIcon className="size-[1.1rem] group-hover:rotate-90" />
          Agregar
        </button>
      ) : compact ? (
        <button
          type="button"
          onClick={handleOpen}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Agregar título a la lista"
          className={segmentActionCompactClass}
        >
          <SegmentPlusIcon className="group-hover/action:rotate-90" />
          <SegmentActionTooltip label="Agregar títulos" />
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
              autoFocus={focusSearchOnOpen}
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

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4"
          data-no-sheet-drag
        >
          {filtered.length > 0 ? (
            <section className="space-y-2" aria-label="En Filmia">
              {showTmdb ? <SectionLabel>En Filmia</SectionLabel> : null}
              <ul className="space-y-2">
                {visibleLocal.map((title) => (
                  <li key={title.id}>
                    <CandidateRow
                      name={title.name}
                      posterPath={title.posterPath}
                      meta={title.year ? String(title.year) : null}
                      actionLabel={addedKeys.has(title.id) ? "Añadida ✓" : "Agregar"}
                      added={addedKeys.has(title.id)}
                      busy={isPending && pendingId === title.id}
                      onClick={() => handleAdd(title)}
                    />
                  </li>
                ))}
                {hasMoreLocal ? (
                  <li ref={setMoreSentinel} aria-hidden="true" className="h-px" />
                ) : null}
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
                    const justAdded = addedKeys.has(candidate.key);
                    const inList = candidate.state === "in-list" && !justAdded;
                    const meta = [result.year, TITLE_KIND_LABEL[result.kind]]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <li key={candidate.key}>
                        <CandidateRow
                          name={result.name}
                          posterPath={result.posterPath}
                          meta={meta}
                          actionLabel={inList ? "En la lista" : justAdded ? "Añadida ✓" : "Agregar"}
                          added={justAdded}
                          busy={isPending && pendingId === candidate.key}
                          disabled={inList}
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
        <div className="flex shrink-0 justify-end border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" onClick={handleClose} className="press-scale px-6">
            Listo
          </Button>
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
  disabled = false,
  added = false,
  busy = false,
  muted = false,
  onClick,
}: {
  name: string;
  posterPath: string | null;
  meta: string | null;
  actionLabel: string;
  disabled?: boolean;
  added?: boolean;
  busy?: boolean;
  muted?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-busy={busy || undefined}
    aria-pressed={added}
    aria-label={
      muted ? `${name} ya está en la lista` : added ? `${name} añadida a la lista. Toca para quitarla` : `Agregar ${name} a la lista`
    }
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
        tmdbSize="w185"
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
        muted ? "text-mist" : added ? "text-success" : "text-accent",
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
