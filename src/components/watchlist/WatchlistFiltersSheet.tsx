"use client";

import { useId, useMemo, useState } from "react";
import type { Platform } from "@/db";
import { Sheet, SheetHandle, useOpenGeneration } from "@/components/Sheet";
import {
  DurationSection,
  KindSection,
  PlatformsSection,
  YearSection,
} from "@/components/watchlist/WatchlistFilterSections";
import {
  AddedSection,
  GenreSection,
  LanguageSection,
  MoreSection,
  PeopleSection,
  RatingSection,
} from "@/components/watchlist/WatchlistFilterSectionsMore";
import { cn } from "@/lib/cn";
import { pillActionClass } from "@/lib/ui";
import { missingRuntimeCount, type WatchlistCounter } from "@/lib/watchlist-facets";
import type { WatchlistGenreCount, WatchlistMatchContext, WatchlistRow } from "@/lib/watchlist-filters";
import { clearFilters, type WatchlistQuery } from "@/lib/watchlist-query";
import type { WatchlistPersonCount } from "@/lib/watchlist-rows";

export type WatchlistFacetData = {
  genres: WatchlistGenreCount[];
  people: WatchlistPersonCount[];
  languages: { code: string; count: number }[];
  decades: number[];
  years: { min: number; max: number };
};

type WatchlistFiltersSheetProps = {
  open: boolean;
  query: WatchlistQuery;
  rows: readonly WatchlistRow[];
  context: WatchlistMatchContext;
  count: WatchlistCounter;
  facets: WatchlistFacetData;
  userPlatforms: readonly Platform[];
  onClose: () => void;
  onApply: (next: WatchlistQuery) => void;
};

/**
 * Filtros (FIL-I34-4): every section works on a draft; each choice shows how many titles it
 * leaves and «Ver N» says what applying gives. Nothing changes on the list until «Ver N».
 */
export const WatchlistFiltersSheet = ({ open, onClose, ...rest }: WatchlistFiltersSheetProps) => {
  const titleId = useId();
  const generation = useOpenGeneration(open);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      overlayLabel="Cerrar filtros"
      layer="top"
      dragDismiss
      portal
      panelClassName="qv-sheet max-h-[min(45rem,92dvh)]"
    >
      <FiltersBody key={generation} titleId={titleId} {...rest} />
    </Sheet>
  );
};

/** Keyed per open so the draft starts from what is applied, without effects. */
const FiltersBody = ({
  titleId,
  query,
  rows,
  context,
  count,
  facets,
  userPlatforms,
  onApply,
}: Omit<WatchlistFiltersSheetProps, "open" | "onClose"> & { titleId: string }) => {
  const [draft, setDraft] = useState(query);
  const total = count(draft);
  const missingRuntime = useMemo(() => missingRuntimeCount(rows, draft, context), [rows, draft, context]);
  const section = { draft, count, onChange: setDraft };

  return (
    <>
      <div className="flex flex-col items-center px-5 pt-3">
        <SheetHandle />
        <h2 id={titleId} className="w-full text-left font-serif text-[1.625rem] text-paper">
          Filtros
        </h2>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4" data-no-sheet-drag>
        <KindSection {...section} />
        <PlatformsSection {...section} userPlatforms={userPlatforms} />
        <DurationSection {...section} missingRuntime={missingRuntime} />
        <YearSection {...section} decades={facets.decades} bounds={facets.years} />
        <RatingSection {...section} />
        <GenreSection {...section} genres={facets.genres} />
        <MoreSection {...section} />
        <PeopleSection {...section} people={facets.people} />
        <AddedSection {...section} />
        <LanguageSection {...section} languages={facets.languages} />
      </div>
      <div className="flex gap-3 border-t border-line px-5 pb-2 pt-3">
        <button
          type="button"
          onClick={() => setDraft({ ...clearFilters(query), scope: query.scope })}
          className={cn(pillActionClass.neutral, "h-[50px] flex-1 justify-center text-[0.9375rem]")}
        >
          Restablecer
        </button>
        <button
          type="button"
          onClick={() => onApply(draft)}
          disabled={total === 0}
          aria-label={total === 0 ? "Ver 0 títulos, sin resultados" : `Ver ${total} ${total === 1 ? "título" : "títulos"}`}
          className={cn(pillActionClass.primary, "h-[50px] min-w-[6.5rem] justify-center gap-2 text-[0.9375rem] disabled:opacity-50")}
        >
          Ver <span className="tabular-nums">{total}</span>
        </button>
      </div>
    </>
  );
};
