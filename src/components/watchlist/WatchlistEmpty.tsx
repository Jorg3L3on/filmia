"use client";

import { ChevronIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import type { WatchlistEmptyCopy, WatchlistExit } from "@/lib/watchlist-empty";
import type { WatchlistQuery } from "@/lib/watchlist-query";

type WatchlistEmptyProps = {
  copy: WatchlistEmptyCopy;
  exits: WatchlistExit[];
  onPick: (query: WatchlistQuery) => void;
};

const FilmIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path strokeLinecap="round" d="M8 4v16M16 4v16M4 9h4M16 9h4M4 15h4M16 15h4" />
  </svg>
);

/**
 * 0 results (FIL-I34-5): «Nada con esa mezcla» and one exit per active filter with how many
 * titles it brings back; the best one is highlighted, «Limpiar todo» comes last.
 */
export const WatchlistEmpty = ({ copy, exits, onPick }: WatchlistEmptyProps) => (
  <section className="flex flex-col items-center px-2 pb-4 pt-8 text-center" aria-labelledby="qv-empty-title">
    <span className="qv-empty-icon">
      <FilmIcon />
    </span>
    <h2 id="qv-empty-title" className="mt-5 font-serif text-[1.625rem] leading-tight text-paper">
      {copy.title}
    </h2>
    <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-fog">{copy.description}</p>
    <ul className="mt-6 w-full space-y-2 text-left">
      {exits.map((exit) => (
        <li key={exit.key}>
          <button
            type="button"
            onClick={() => onPick(exit.query)}
            aria-label={`${exit.label}: ${exit.count} ${exit.count === 1 ? "título" : "títulos"}`}
            className={cn("qv-exit press-scale", focusRing, exit.best && "is-best", exit.key === "all" && "is-quiet")}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.9375rem] text-paper">{exit.label}</span>
              {exit.best ? <span className="block text-xs text-mist">el que más recorta</span> : null}
            </span>
            <span className="shrink-0 text-xs text-mist">
              <span className="text-base font-semibold tabular-nums text-paper">{exit.count}</span>{" "}
              {exit.count === 1 ? "título" : "títulos"}
            </span>
            <span className="-rotate-90 text-mist">
              <ChevronIcon size={14} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  </section>
);
