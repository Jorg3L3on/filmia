"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { searchTmdbDiscover } from "@/app/actions/metadata";
import { addTitleFromTmdb } from "@/app/actions/titles";
import { PosterImage } from "@/components/PosterImage";
import type { TitleKind } from "@/generated/prisma/browser";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import type { UserTmdbEntry } from "@/lib/queries";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { btnGhost, btnPrimary, fieldClass, focusRing, wellClass } from "@/lib/ui";

type AddTitleDestination = "watchlist" | "watched";

type CatalogEntry = {
  titleId: string;
  inWatchlist: boolean;
  watched: boolean;
};

const catalogKey = (tmdbId: number, kind: TitleKind) => `${kind}:${tmdbId}`;

const toCatalogMap = (entries: UserTmdbEntry[]) => {
  const next = new Map<string, CatalogEntry>();
  for (const entry of entries) {
    const mapped = {
      titleId: entry.titleId,
      inWatchlist: entry.inWatchlist,
      watched: entry.watched,
    };
    next.set(catalogKey(entry.tmdbId, entry.kind), mapped);
    next.set(String(entry.tmdbId), mapped);
  }
  return next;
};

const DESTINATIONS: Array<{ value: AddTitleDestination; label: string }> = [
  { value: "watchlist", label: "Quiero ver" },
  { value: "watched", label: "Ya vista" },
];

type DiaryAddTitleFabProps = {
  configured: { tmdb: boolean; omdb: boolean };
  existing: UserTmdbEntry[];
};

export const DiaryAddTitleFab = ({
  configured,
  existing,
}: DiaryAddTitleFabProps) => {
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [destination, setDestination] = useState<AddTitleDestination>("watchlist");
  const [results, setResults] = useState<TmdbCatalogResult[]>([]);
  const [catalog, setCatalog] = useState(() => toCatalogMap(existing));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setError(null);
    setNotice(null);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    searchRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose, open]);

  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!configured.tmdb || !trimmed) {
      return;
    }

    startTransition(async () => {
      setError(null);
      setNotice(null);
      const { results: hits, error: searchError } = await searchTmdbDiscover(trimmed);
      setHasSearched(true);
      setResults(hits);
      if (searchError) {
        setError(searchError);
        return;
      }

      if (hits.length === 0) {
        setError("Nada en TMDB con esa búsqueda.");
      }
    });
  }, [configured.tmdb, query]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSearch();
  };

  const handleAdd = (result: TmdbCatalogResult) => {
    const key = catalogKey(result.tmdbId, result.kind);
    const local = catalog.get(key) ?? catalog.get(String(result.tmdbId));
    if (destination === "watchlist" && local?.inWatchlist) {
      return;
    }

    if (destination === "watched" && local?.watched) {
      return;
    }

    startTransition(async () => {
      setError(null);
      setNotice(null);
      setPendingKey(key);
      const outcome = await addTitleFromTmdb({
        tmdbId: result.tmdbId,
        kind: result.kind,
        name: result.name,
        originalName: result.originalName,
        year: result.year,
        posterPath: result.posterPath,
        destination,
      });
      setPendingKey(null);

      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }

      setCatalog((current) => {
        const next = new Map(current);
        const previous = current.get(key) ?? current.get(String(result.tmdbId));
        const entry = {
          titleId: outcome.titleId,
          inWatchlist:
            destination === "watchlist" ? true : Boolean(previous?.inWatchlist) && !outcome.markedWatched,
          watched: destination === "watched" ? true : Boolean(previous?.watched),
        };
        next.set(key, entry);
        next.set(String(result.tmdbId), entry);
        return next;
      });

      if (destination === "watchlist") {
        setNotice(
          outcome.created
            ? `${result.name} ya está en Filmia y en Quiero ver.`
            : `${result.name} se agregó a Quiero ver.`,
        );
        return;
      }

      setNotice(
        outcome.created
          ? `${result.name} quedó marcada como ya vista.`
          : `${result.name} se marcó como ya vista.`,
      );
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Agregar una película"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-accent text-ink shadow-[0_10px_24px_rgba(0,224,84,0.32)]",
          "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-6",
          focusRing,
          "focus-visible:outline-white",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="size-7"
          aria-hidden="true"
        >
          <path strokeLinecap="round" d="M12 6.5v11M6.5 12h11" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar buscador"
            className="absolute inset-0 bg-black/70"
            onClick={handleClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              wellClass,
              "relative z-10 flex max-h-[min(40rem,88vh)] w-full max-w-xl flex-col overflow-hidden",
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 id={titleId} className="font-serif text-2xl text-white">
                  Agregar título
                </h2>
                <p className="mt-1 text-sm text-fog">
                  Busca en TMDB y mándalo a Quiero ver o márcalo como ya vista.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={handleClose}
                aria-label="Cerrar"
                className={cn(
                  "rounded-full p-2 text-mist hover:text-white",
                  focusRing,
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  className="size-5"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" d="M7 7l10 10M17 7 7 17" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div
                role="group"
                aria-label="Destino"
                className="inline-flex rounded-full border border-chrome bg-well p-1"
              >
                {DESTINATIONS.map((item) => {
                  const isCurrent = destination === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={isCurrent}
                      onClick={() => setDestination(item.value)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide",
                        focusRing,
                        isCurrent ? "bg-accent text-ink" : "text-fog hover:text-white",
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {!configured.tmdb ? (
                <p
                  role="alert"
                  className="rounded-md border border-dashed border-chrome bg-well/70 p-4 text-sm text-fog"
                >
                  Falta <code className="text-accent">TMDB_API_KEY</code> en el
                  entorno. Sin esa llave no se puede buscar.
                </p>
              ) : (
                <form role="search" onSubmit={handleSubmit} className="space-y-3">
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
                      Buscar en TMDB
                    </span>
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Dune, Severance, Gladiator…"
                      className={`${fieldClass} py-3 text-base`}
                      autoComplete="off"
                      aria-label="Buscar títulos en TMDB"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isPending || !query.trim()}
                    className={`${btnPrimary} disabled:opacity-50`}
                  >
                    {isPending && !pendingKey ? "Buscando…" : "Buscar"}
                  </button>
                </form>
              )}

              {error ? (
                <p
                  role="alert"
                  className="rounded-sm border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              ) : null}

              {notice ? (
                <p role="status" className="text-sm text-accent">
                  {notice}
                </p>
              ) : null}

              {results.length > 0 ? (
                <ul className="grid grid-cols-2 gap-3">
                  {results.map((result) => {
                    const key = catalogKey(result.tmdbId, result.kind);
                    const local =
                      catalog.get(key) ?? catalog.get(String(result.tmdbId));
                    const url = tmdbPosterUrl(result.posterPath, "w185");
                    const isAdding = pendingKey === key;
                    const alreadyInDestination =
                      destination === "watchlist"
                        ? Boolean(local?.inWatchlist)
                        : Boolean(local?.watched);

                    return (
                      <li key={key}>
                        <article className="flex h-full flex-col overflow-hidden rounded-poster border border-line bg-surface">
                          {url ? (
                            <PosterImage
                              name={result.name}
                              posterPath={result.posterPath}
                              sizes="180px"
                              className="rounded-none"
                            />
                          ) : (
                            <div className="flex aspect-[2/3] items-center justify-center bg-well text-[10px] uppercase tracking-wide text-mist">
                              Sin poster
                            </div>
                          )}
                          <div className="flex flex-1 flex-col gap-2 p-3">
                            <div className="space-y-1">
                              <h3 className="line-clamp-2 text-sm font-medium leading-tight text-white">
                                {result.name}
                              </h3>
                              <p className="text-[11px] uppercase tracking-wide text-mist">
                                {TITLE_KIND_LABEL[result.kind]}
                                {result.year ? ` · ${result.year}` : ""}
                              </p>
                            </div>
                            {alreadyInDestination ? (
                              <div className="mt-auto flex flex-col gap-2">
                                <p className="text-xs font-medium text-accent">
                                  {destination === "watchlist"
                                    ? "Ya en Quiero ver"
                                    : "Ya vista"}
                                </p>
                                {local ? (
                                  <Link
                                    href={`/titulos/${local.titleId}`}
                                    className={`${btnGhost} w-full text-xs`}
                                  >
                                    Ver ficha
                                  </Link>
                                ) : null}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAdd(result)}
                                disabled={isPending}
                                aria-label={
                                  destination === "watchlist"
                                    ? `Agregar ${result.name} a Quiero ver`
                                    : `Marcar ${result.name} como ya vista`
                                }
                                className={`${btnPrimary} mt-auto w-full text-xs disabled:opacity-50`}
                              >
                                {isAdding
                                  ? "Agregando…"
                                  : destination === "watchlist"
                                    ? "A Quiero ver"
                                    : "Ya vista"}
                              </button>
                            )}
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              ) : hasSearched && !error && !isPending ? (
                <p className="text-sm text-mist">No hay resultados. Prueba otra búsqueda.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
