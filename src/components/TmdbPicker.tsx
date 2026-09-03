"use client";

import Image from "next/image";
import { useCallback, useState, useTransition } from "react";
import { enrichFromTmdb, searchTmdb } from "@/app/actions/metadata";
import type { TitleKind } from "@/generated/prisma/client";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { btnGhost, btnPrimary, fieldClass, focusRing } from "@/lib/ui";

type TmdbPickerProps = {
  initialTmdbId?: number | null;
  initialPosterPath?: string | null;
  initialImdbId?: string | null;
  initialImdbRating?: number | null;
  configured: { tmdb: boolean; omdb: boolean };
};

type SearchResult = Awaited<ReturnType<typeof searchTmdb>>[number];

export const TmdbPicker = ({
  initialTmdbId = null,
  initialPosterPath = null,
  initialImdbId = null,
  initialImdbRating = null,
  configured,
}: TmdbPickerProps) => {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<TitleKind>("MOVIE");
  const [year, setYear] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<{
    tmdbId: number;
    posterPath: string | null;
    imdbId: string | null;
    imdbRating: number | null;
    label: string;
  } | null>(
    initialTmdbId
      ? {
          tmdbId: initialTmdbId,
          posterPath: initialPosterPath,
          imdbId: initialImdbId,
          imdbRating: initialImdbRating,
          label: "Selección actual",
        }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = useCallback(() => {
    if (!configured.tmdb) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const yearNum = year.trim() ? Number(year) : null;
      const hits = await searchTmdb(query, kind, yearNum);
      setResults(hits);
      if (hits.length === 0) {
        setError("Sin resultados en TMDB.");
      }
    });
  }, [configured.tmdb, kind, query, year]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      startTransition(async () => {
        setError(null);
        try {
          const enriched = await enrichFromTmdb(result.tmdbId, kind);
          setSelected({
            tmdbId: enriched.tmdbId!,
            posterPath: enriched.posterPath,
            imdbId: enriched.imdbId,
            imdbRating: enriched.imdbRating,
            label: enriched.name ?? result.name,
          });
          setResults([]);
        } catch {
          setError("No se pudo enriquecer la selección.");
        }
      });
    },
    [kind],
  );

  const handleClear = useCallback(() => {
    setSelected(null);
    setResults([]);
    setError(null);
  }, []);

  if (!configured.tmdb) {
    return (
      <p className="rounded-md border border-dashed border-chrome p-4 text-sm text-fog">
        Agrega <code className="text-accent">TMDB_API_KEY</code> y{" "}
        <code className="text-accent">OMDB_API_KEY</code> en{" "}
        <code className="text-accent">.env</code> para buscar posters e IMDb
        (tiers gratuitos).
      </p>
    );
  }

  const previewUrl = tmdbPosterUrl(selected?.posterPath, "w185");

  return (
    <fieldset className="space-y-4 rounded-md border border-line bg-well p-4">
      <legend className="px-1 text-xs uppercase tracking-wide text-accent">
        Poster y rating IMDb (TMDB + OMDb)
      </legend>

      <input type="hidden" name="tmdbId" value={selected?.tmdbId ?? ""} />
      <input type="hidden" name="posterPath" value={selected?.posterPath ?? ""} />
      <input type="hidden" name="imdbId" value={selected?.imdbId ?? ""} />
      <input
        type="hidden"
        name="imdbRating"
        value={selected?.imdbRating ?? ""}
      />

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <label className="block space-y-1">
          <span className="text-xs text-fog">Buscar en TMDB</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Gladiator, Severance…"
            className={fieldClass}
            autoComplete="off"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-fog">Tipo búsqueda</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as TitleKind)}
            className={fieldClass}
          >
            <option value="MOVIE">Película</option>
            <option value="SERIES">Serie</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-fog">Año (opc.)</span>
          <input
            value={year}
            onChange={(event) => setYear(event.target.value)}
            type="number"
            min={1888}
            max={2100}
            className={fieldClass}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSearch}
          disabled={isPending || !query.trim()}
          className={`${btnPrimary} disabled:opacity-50`}
        >
          {isPending ? "Buscando…" : "Buscar poster"}
        </button>
        {selected ? (
          <button type="button" onClick={handleClear} className={btnGhost}>
            Quitar selección
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {selected ? (
        <div className="flex items-center gap-4 rounded-md border border-line bg-canvas-deep p-3">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt=""
              width={60}
              height={90}
              className="rounded-poster"
            />
          ) : (
            <div className="flex h-[90px] w-[60px] items-center justify-center rounded-poster bg-surface text-xs text-mist">
              Sin poster
            </div>
          )}
          <div className="space-y-1 text-sm">
            <p className="font-medium text-white">{selected.label}</p>
            <p className="text-fog">TMDB #{selected.tmdbId}</p>
            {selected.imdbRating != null ? (
              <p className="text-imdb">IMDb {selected.imdbRating.toFixed(1)}/10</p>
            ) : configured.omdb ? (
              <p className="text-mist">IMDb no disponible</p>
            ) : (
              <p className="text-mist">OMDB_API_KEY pendiente</p>
            )}
          </div>
        </div>
      ) : null}

      {results.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {results.map((result) => {
            const url = tmdbPosterUrl(result.posterPath, "w185");
            return (
              <li key={result.tmdbId}>
                <button
                  type="button"
                  onClick={() => handleSelect(result)}
                  disabled={isPending}
                  className={`w-full overflow-hidden rounded-poster border border-line bg-surface text-left transition hover:border-accent/50 ${focusRing}`}
                >
                  {url ? (
                    <Image
                      src={url}
                      alt=""
                      width={185}
                      height={278}
                      className="aspect-[2/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[2/3] items-center justify-center bg-well text-xs text-mist">
                      Sin poster
                    </div>
                  )}
                  <div className="space-y-0.5 p-2">
                    <p className="line-clamp-2 text-xs font-medium text-white">
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
    </fieldset>
  );
};
