"use client";

import { useCallback, useState, useTransition } from "react";
import { enrichFromTmdb, searchTmdb } from "@/app/actions/metadata";
import type { TitleKind } from "@/db";
import { cn } from "@/lib/cn";
import { tmdbPosterUrl, TMDB_UNAVAILABLE_COPY } from "@/lib/tmdb";
import { Button } from "@/components/Button";
import { PosterImage } from "@/components/PosterImage";
import { fieldClass, focusRing } from "@/lib/ui";

export type TmdbPick = {
  tmdbId: number;
  posterPath: string | null;
  imdbId: string | null;
  imdbRating: number | null;
  name: string;
  originalName: string | null;
  year: number | null;
};

type TmdbPickerProps = {
  initialTmdbId?: number | null;
  initialPosterPath?: string | null;
  initialImdbId?: string | null;
  initialImdbRating?: number | null;
  configured: { tmdb: boolean; omdb: boolean };
  kind: TitleKind;
  onPicked?: (pick: TmdbPick) => void;
  onCleared?: () => void;
};

type SearchResult = Awaited<ReturnType<typeof searchTmdb>>["results"][number];

export const TmdbPicker = ({
  initialTmdbId = null,
  initialPosterPath = null,
  initialImdbId = null,
  initialImdbRating = null,
  configured,
  kind,
  onPicked,
  onCleared,
}: TmdbPickerProps) => {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<TmdbPick | null>(
    initialTmdbId
      ? {
          tmdbId: initialTmdbId,
          posterPath: initialPosterPath,
          imdbId: initialImdbId,
          imdbRating: initialImdbRating,
          name: "",
          originalName: null,
          year: null,
        }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = useCallback(() => {
    if (!configured.tmdb || !query.trim()) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const yearNum = year.trim() ? Number(year) : null;
      const { results: hits, error: searchError } = await searchTmdb(
        query,
        kind,
        yearNum,
      );
      setResults(hits);
      if (searchError) {
        setError(searchError);
        return;
      }
      if (hits.length === 0) {
        setError("Nada en TMDB con esa búsqueda.");
      }
    });
  }, [configured.tmdb, kind, query, year]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      startTransition(async () => {
        setError(null);
        try {
          const enriched = await enrichFromTmdb(result.tmdbId, kind);
          const pick: TmdbPick = {
            tmdbId: enriched.tmdbId!,
            posterPath: enriched.posterPath,
            imdbId: enriched.imdbId,
            imdbRating: enriched.imdbRating,
            name: enriched.name ?? result.name,
            originalName: enriched.originalName ?? null,
            year: enriched.year ?? result.year ?? null,
          };
          setSelected(pick);
          setResults([]);
          onPicked?.(pick);
        } catch {
          setError("No se pudo cargar esa ficha.");
        }
      });
    },
    [kind, onPicked],
  );

  const handleClear = useCallback(() => {
    setSelected(null);
    setResults([]);
    setError(null);
    onCleared?.();
  }, [onCleared]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    handleSearch();
  };

  if (!configured.tmdb) {
    return (
      <p className="rounded-md border border-dashed border-chrome p-4 text-sm text-fog">
        {TMDB_UNAVAILABLE_COPY}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="tmdbId" value={selected?.tmdbId ?? ""} />
      <input type="hidden" name="posterPath" value={selected?.posterPath ?? ""} />
      <input type="hidden" name="imdbId" value={selected?.imdbId ?? ""} />
      <input type="hidden" name="imdbRating" value={selected?.imdbRating ?? ""} />

      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
            Buscar en TMDB
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Gladiator, Severance, Dune…"
            className={fieldClass}
            autoComplete="off"
            aria-label="Buscar en TMDB"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-28 space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
              Año
            </span>
            <input
              value={year}
              onChange={(event) => setYear(event.target.value)}
              type="number"
              min={1888}
              max={2100}
              placeholder="Opcional"
              className={fieldClass}
            />
          </label>
          <Button
            type="button"
            onClick={handleSearch}
            pending={isPending}
            pendingLabel="Buscando…"
            disabled={!query.trim()}
          >
            Buscar
          </Button>
          {selected ? (
            <Button type="button" variant="ghost" onClick={handleClear}>
              Quitar ficha
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {results.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {results.map((result) => {
            const url = tmdbPosterUrl(result.posterPath, "w185");
            return (
              <li key={result.tmdbId}>
                <button
                  type="button"
                  onClick={() => handleSelect(result)}
                  disabled={isPending}
                  aria-label={`Elegir ${result.name}${result.year ? ` (${result.year})` : ""}`}
                  className={cn(
                    "group w-full overflow-hidden rounded-poster border border-line bg-surface text-left transition hover:border-accent/50",
                    focusRing,
                  )}
                >
                  {url ? (
                    <PosterImage
                      name={result.name}
                      posterPath={result.posterPath}
                      sizes="160px"
                      className="rounded-none"
                    />
                  ) : (
                    <div className="flex aspect-[2/3] items-center justify-center bg-well text-[10px] uppercase tracking-wide text-mist">
                      Sin poster
                    </div>
                  )}
                  <div className="space-y-0.5 p-2">
                    <p className="line-clamp-2 text-[11px] font-medium leading-tight text-white">
                      {result.name}
                    </p>
                    {result.year ? (
                      <p className="text-[10px] text-mist">{result.year}</p>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
