"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchTmdbDiscover } from "@/app/actions/metadata";
import { cn } from "@/lib/cn";
import type { TitleGuess } from "@/lib/juegos/diarias/core";
import { focusRing } from "@/lib/ui";

type Hit = { tmdbId: number; name: string; year: number | null };

const DEBOUNCE_MS = 320;

/**
 * The answer box of the diarias (FIL-I54): the app's title search (`searchTmdbDiscover`, the same
 * one Buscar uses), movies only, as text. No posters in the list: in Detalle they would give the
 * answer away. Picking a row sends the guess; the server judges it.
 */
export const DiariaTitleSearch = ({
  placeholder,
  disabled = false,
  onPick,
  label = "Nombre de la película",
}: {
  placeholder: string;
  disabled?: boolean;
  onPick: (guess: TitleGuess) => void;
  label?: string;
}) => {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "empty">("idle");
  const seq = useRef(0);

  useEffect(() => {
    const words = query.trim();
    const mine = ++seq.current;
    if (words.length < 2) {
      return;
    }
    const timer = window.setTimeout(() => {
      setStatus("loading");
      searchTmdbDiscover(words)
        .then((answer) => {
          if (mine !== seq.current) return;
          const movies = answer.results.filter((hit) => hit.kind === "MOVIE").slice(0, 6);
          setHits(movies.map((hit) => ({ tmdbId: hit.tmdbId, name: hit.name, year: hit.year })));
          setStatus(answer.error ? "error" : movies.length === 0 ? "empty" : "idle");
        })
        .catch(() => {
          if (mine === seq.current) setStatus("error");
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const pick = (hit: Hit) => {
    seq.current += 1;
    setQuery("");
    setHits([]);
    setStatus("idle");
    onPick({ tmdbId: hit.tmdbId, name: hit.name });
  };

  const showList = query.trim().length >= 2 && hits.length > 0;

  return (
    <div className="flex flex-col gap-1.5" data-diaria="buscador">
      <label className="flex min-h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-accent/60">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="size-5 shrink-0 text-fog">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4 4" />
        </svg>
        <span className="sr-only">{label}</span>
        <input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            if (value.trim().length < 2) {
              setHits([]);
              setStatus("idle");
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          aria-controls={listId}
          className="min-w-0 flex-1 bg-transparent text-base text-paper placeholder:text-fog focus:outline-none disabled:opacity-50"
        />
      </label>
      {showList ? (
        <ul id={listId} className="overflow-hidden rounded-2xl border border-line bg-surface" aria-label="Resultados">
          {hits.map((hit) => (
            <li key={hit.tmdbId} className="border-t border-line first:border-t-0">
              <button
                type="button"
                disabled={disabled}
                onClick={() => pick(hit)}
                className={cn("flex min-h-12 w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-white/[0.04]", focusRing)}
              >
                <b className="min-w-0 flex-1 truncate text-[15px] font-semibold text-paper">{hit.name}</b>
                {hit.year ? <span className="text-sm tabular-nums text-fog">{hit.year}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {query.trim().length >= 2 && status === "loading" && hits.length === 0 ? <p className="px-1 text-sm text-fog">Buscando…</p> : null}
      {query.trim().length >= 2 && status === "empty" ? <p className="px-1 text-sm text-fog">No encontramos esa película.</p> : null}
      {status === "error" ? <p className="px-1 text-sm text-danger">La búsqueda no respondió. Intenta otra vez.</p> : null}
    </div>
  );
};
