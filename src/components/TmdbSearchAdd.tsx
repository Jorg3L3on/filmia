"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { searchTmdbDiscover } from "@/app/actions/metadata";
import { addTitleFromTmdb } from "@/app/actions/titles";
import { PosterImage } from "@/components/PosterImage";
import type { TitleKind } from "@/db";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL, TITLE_KINDS } from "@/lib/labels";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { tmdbPosterUrl } from "@/lib/tmdb";
import type { UserTmdbEntry } from "@/lib/queries";
import {
  btnGhost,
  btnPrimary,
  fieldClass,
  focusRing,
  wellClass,
} from "@/lib/ui";

type KindFilter = TitleKind | "ALL";

const KIND_FILTERS: Array<{ value: KindFilter; label: string }> = [
  { value: "ALL", label: "Todas" },
  ...TITLE_KINDS.map((kind) => ({
    value: kind,
    label: TITLE_KIND_LABEL[kind],
  })),
];

type CatalogEntry = {
  titleId: string;
  inWatchlist: boolean;
};

const catalogKey = (tmdbId: number, kind: TitleKind) => `${kind}:${tmdbId}`;

const toCatalogMap = (entries: UserTmdbEntry[]) => {
  const next = new Map<string, CatalogEntry>();
  for (const entry of entries) {
    next.set(catalogKey(entry.tmdbId, entry.kind), {
      titleId: entry.titleId,
      inWatchlist: entry.inWatchlist,
    });
    next.set(String(entry.tmdbId), {
      titleId: entry.titleId,
      inWatchlist: entry.inWatchlist,
    });
  }
  return next;
};

type TmdbSearchAddProps = {
  configured: { tmdb: boolean; omdb: boolean };
  existing: UserTmdbEntry[];
  initialQuery?: string;
  initialResults?: TmdbCatalogResult[];
  initialError?: string | null;
};

export const TmdbSearchAdd = ({
  configured,
  existing,
  initialQuery = "",
  initialResults = [],
  initialError = null,
}: TmdbSearchAddProps) => {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");
  const [addToWatchlist, setAddToWatchlist] = useState(true);
  const [results, setResults] = useState<TmdbCatalogResult[]>(initialResults);
  const [catalog, setCatalog] = useState(() => toCatalogMap(existing));
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery.trim()));
  const [isPending, startTransition] = useTransition();

  const visibleResults = useMemo(
    () =>
      kindFilter === "ALL"
        ? results
        : results.filter((result) => result.kind === kindFilter),
    [kindFilter, results],
  );

  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!configured.tmdb || !trimmed) {
      return;
    }

    startTransition(async () => {
      setError(null);
      setNotice(null);
      const { results: hits, error: searchError } =
        await searchTmdbDiscover(trimmed);
      setHasSearched(true);
      setResults(hits);
      router.replace(`/buscar?q=${encodeURIComponent(trimmed)}`, {
        scroll: false,
      });
      if (searchError) {
        setError(searchError);
        return;
      }
      if (hits.length === 0) {
        setError("Nada en TMDB con esa búsqueda.");
      }
    });
  }, [configured.tmdb, query, router]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSearch();
  };

  const handleAdd = (result: TmdbCatalogResult) => {
    const key = catalogKey(result.tmdbId, result.kind);
    if (catalog.has(key) || catalog.has(String(result.tmdbId))) {
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
        addToWatchlist,
      });
      setPendingKey(null);

      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }

      setCatalog((current) => {
        const next = new Map(current);
        const entry = {
          titleId: outcome.titleId,
          inWatchlist: outcome.addedToWatchlist,
        };
        next.set(key, entry);
        next.set(String(result.tmdbId), entry);
        return next;
      });
      setNotice(
        outcome.created
          ? addToWatchlist
            ? `${result.name} ya está en Filmia y en Quiero ver.`
            : `${result.name} ya está en Filmia.`
          : `${result.name} ya estaba en Filmia.`,
      );
    });
  };

  if (!configured.tmdb) {
    return (
      <p
        role="alert"
        className="rounded-md border border-dashed border-chrome bg-well/70 p-5 text-sm text-fog"
      >
        Falta <code className="text-accent">TMDB_API_KEY</code> en el entorno.
        Sin esa llave no se puede buscar ni agregar desde TMDB.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <form
        role="search"
        onSubmit={handleSubmit}
        className={cn(wellClass, "space-y-4 p-5")}
      >
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
            Buscar en TMDB
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Dune, Severance, Gladiator…"
            className={`${fieldClass} py-3 text-base`}
            autoComplete="off"
            autoFocus
            aria-label="Buscar títulos en TMDB"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Tipo de título"
            className="inline-flex rounded-full border border-chrome bg-well p-1"
          >
            {KIND_FILTERS.map((filter) => {
              const isCurrent = kindFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={isCurrent}
                  onClick={() => setKindFilter(filter.value)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide",
                    focusRing,
                    isCurrent ? "bg-accent text-ink" : "text-fog hover:text-white",
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={isPending || !query.trim()}
            className={`${btnPrimary} disabled:opacity-50`}
          >
            {isPending && !pendingKey ? "Buscando…" : "Buscar"}
          </button>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-fog">
          <input
            type="checkbox"
            checked={addToWatchlist}
            onChange={(event) => setAddToWatchlist(event.target.checked)}
            className="size-4 accent-accent"
          />
          También a Quiero ver
        </label>
      </form>

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

      {visibleResults.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleResults.map((result) => {
            const key = catalogKey(result.tmdbId, result.kind);
            const local =
              catalog.get(key) ?? catalog.get(String(result.tmdbId));
            const url = tmdbPosterUrl(result.posterPath, "w185");
            const isAdding = pendingKey === key;

            return (
              <li key={key}>
                <article className="flex h-full flex-col overflow-hidden rounded-poster border border-line bg-surface">
                  {url ? (
                    <PosterImage
                      name={result.name}
                      posterPath={result.posterPath}
                      sizes="220px"
                      className="rounded-none"
                    />
                  ) : (
                    <div className="flex aspect-[2/3] items-center justify-center bg-well text-[10px] uppercase tracking-wide text-mist">
                      Sin poster
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="space-y-1">
                      <h2 className="line-clamp-2 text-sm font-medium leading-tight text-white">
                        {result.name}
                      </h2>
                      <p className="text-[11px] uppercase tracking-wide text-mist">
                        {TITLE_KIND_LABEL[result.kind]}
                        {result.year ? ` · ${result.year}` : ""}
                      </p>
                    </div>
                    {local ? (
                      <div className="mt-auto flex flex-col gap-2">
                        <p className="text-xs font-medium text-accent">
                          Ya en Filmia
                          {local.inWatchlist ? " · Quiero ver" : ""}
                        </p>
                        <Link
                          href={`/titulos/${local.titleId}`}
                          className={`${btnGhost} w-full text-xs`}
                        >
                          Ver ficha
                        </Link>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAdd(result)}
                        disabled={isPending}
                        aria-label={`Agregar ${result.name} a Filmia`}
                        className={`${btnPrimary} mt-auto w-full text-xs disabled:opacity-50`}
                      >
                        {isAdding ? "Agregando…" : "Agregar"}
                      </button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : hasSearched && !error && !isPending ? (
        <p className="text-sm text-mist">
          No hay resultados
          {kindFilter === "ALL"
            ? ""
            : ` de tipo ${TITLE_KIND_LABEL[kindFilter].toLowerCase()}`}
          . Prueba otra búsqueda.
        </p>
      ) : null}
    </div>
  );
};
