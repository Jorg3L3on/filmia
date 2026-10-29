"use client";

import { useState } from "react";
import type { Platform } from "@/db";
import { useCondensedBar } from "@/components/watchlist/useCondensedBar";
import { sessionSeed } from "@/components/watchlist/useWatchlistQuery";
import { WatchlistChipRow } from "@/components/watchlist/WatchlistChipRow";
import { useWatchlistEditing } from "@/components/watchlist/WatchlistEditing";
import { WatchlistFiltersSheet, type WatchlistFacetData } from "@/components/watchlist/WatchlistFiltersSheet";
import { WatchlistGenreSheet } from "@/components/watchlist/WatchlistGenreSheet";
import { WatchlistOrderPill } from "@/components/watchlist/WatchlistOrderPill";
import { WatchlistOrderSheet } from "@/components/watchlist/WatchlistOrderSheet";
import { WatchlistScopeBar } from "@/components/watchlist/WatchlistScopeBar";
import { FunnelIcon, WatchlistCount, WatchlistRoundButton, WatchlistTopBar } from "@/components/watchlist/WatchlistTopBar";
import { cn } from "@/lib/cn";
import { focusRing, safeAreaStickyUnderHeaderClass } from "@/lib/ui";
import type { WatchlistChipNames } from "@/lib/watchlist-chips";
import type { WatchlistCounter } from "@/lib/watchlist-facets";
import type { WatchlistMatchContext, WatchlistRow } from "@/lib/watchlist-filters";
import {
  activeFilterCount,
  clearFilters,
  effectiveDirection,
  isNarrowed,
  withoutFilter,
  type WatchlistQuery,
} from "@/lib/watchlist-query";

type WatchlistHeaderProps = {
  query: WatchlistQuery;
  onChange: (next: WatchlistQuery) => void;
  shown: number;
  rows: readonly WatchlistRow[];
  scopeCounts: { all: number; mine: number };
  userPlatforms: readonly Platform[];
  facets: WatchlistFacetData;
  names: WatchlistChipNames;
  context: WatchlistMatchContext;
  count: WatchlistCounter;
};

/**
 * Quiero ver «Barra de decisión» (FIL-I34, option B): title with «N de total», Sorpréndeme and
 * the funnel; the Todo / Mis plataformas scope; the order pill and wrapping chips; one summary
 * line. Scrolling away leaves a 44 px bar with the title, the count, the order and the funnel.
 */
export const WatchlistHeader = ({
  query,
  onChange,
  shown,
  rows,
  scopeCounts,
  userPlatforms,
  facets,
  names,
  context,
  count,
}: WatchlistHeaderProps) => {
  const [sheet, setSheet] = useState<"filters" | "order" | "genres" | null>(null);
  const { condensed, sentinelRef } = useCondensedBar();
  const editing = useWatchlistEditing();
  const total = rows.length;
  const narrowed = isNarrowed(query);
  const filterCount = activeFilterCount(query);
  const random = query.sort === "random";
  const canReorder = Boolean(editing?.canReorder);
  const close = () => setSheet(null);

  const surprise = () =>
    onChange(random ? { ...query, sort: null, dir: null, seed: null } : { ...query, sort: "random", dir: null, seed: sessionSeed() });
  const flip = () => onChange({ ...query, dir: effectiveDirection(query) === "asc" ? "desc" : "asc" });
  const reorder = () => {
    close();
    editing?.setIsEditing(true);
  };

  const orderPill = (compact: boolean) => (
    <WatchlistOrderPill query={query} compact={compact} onOpen={() => setSheet("order")} onFlip={flip} />
  );

  // Limpiar filtros (anything narrows) · Barajar otra vez (Aleatoria) · Reordenar (Mi orden, nothing narrows).
  const summary = narrowed ? (
    <button type="button" onClick={() => onChange(clearFilters(query))} aria-label={`Limpiar filtros. Muestra los ${total} títulos`} className={cn("qv-link is-accent", focusRing)}>
      Limpiar filtros
    </button>
  ) : random ? (
    <button type="button" onClick={() => onChange({ ...query, seed: sessionSeed(true) })} className={cn("qv-link", focusRing)}>
      Barajar otra vez
    </button>
  ) : query.sort === null && canReorder ? (
    <button type="button" onClick={reorder} className={cn("qv-link", focusRing)}>
      Reordenar
    </button>
  ) : null;

  if (editing?.isEditing) return null;

  return (
    <>
      <header className="space-y-2.5" aria-label="Quiero ver: alcance, orden y filtros">
        <WatchlistTopBar
          shown={shown}
          total={total}
          narrowed={narrowed}
          filterCount={filterCount}
          random={random}
          onSurprise={surprise}
          onFilters={() => setSheet("filters")}
        />
        <WatchlistScopeBar
          scope={query.scope}
          counts={scopeCounts}
          userPlatforms={userPlatforms}
          onChange={(scope) => onChange({ ...query, scope })}
        />
        <WatchlistChipRow
          query={query}
          names={names}
          orderPill={orderPill(false)}
          onToggleShort={() => onChange({ ...query, short: !query.short })}
          onOpenGenres={() => setSheet("genres")}
          onRemove={(key) => onChange(withoutFilter(query, key))}
          onMore={() => setSheet("filters")}
        />
        {summary || random ? (
          <div className="flex min-h-6 items-center justify-between gap-3">
            {summary}
            {narrowed && random ? (
              <button type="button" onClick={() => onChange({ ...query, seed: sessionSeed(true) })} className={cn("qv-link", focusRing)}>
                Barajar otra vez
              </button>
            ) : null}
          </div>
        ) : null}
        <div ref={sentinelRef} aria-hidden="true" className="!mt-0 h-px" />

        <WatchlistFiltersSheet
          open={sheet === "filters"}
          query={query}
          rows={rows}
          context={context}
          count={count}
          facets={facets}
          userPlatforms={userPlatforms}
          onClose={close}
          onApply={(next) => {
            close();
            onChange(next);
          }}
        />
        <WatchlistOrderSheet
          open={sheet === "order"}
          query={query}
          canReorder={canReorder}
          onClose={close}
          onSelect={(sort) => onChange({ ...query, sort, dir: null, seed: sort === "random" ? sessionSeed() : null })}
          onDirection={(dir) => onChange({ ...query, dir })}
          onReorder={reorder}
        />
        <WatchlistGenreSheet
          open={sheet === "genres"}
          genres={facets.genres}
          selected={query.genres}
          onClose={close}
          onApply={(genres) => {
            close();
            onChange({ ...query, genres });
          }}
        />
      </header>
      {/* Outside <header>: a sticky box only sticks within its parent, and the list is the parent here. */}
      <div className={cn("sticky z-30 -mx-4 !mt-0 h-0", safeAreaStickyUnderHeaderClass)}>
        <div className="qv-condensed" data-shown={condensed} aria-hidden={!condensed} inert={!condensed}>
          <p className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="truncate font-serif text-xl text-paper">Quiero ver</span>
            <WatchlistCount shown={shown} total={total} narrowed={narrowed} />
          </p>
          {orderPill(true)}
          <WatchlistRoundButton
            label={filterCount > 0 ? `Filtros, ${filterCount} activos. Abre las opciones` : "Filtros. Abre las opciones"}
            badge={filterCount}
            haspopup
            onClick={() => setSheet("filters")}
          >
            <FunnelIcon />
          </WatchlistRoundButton>
        </div>
      </div>
    </>
  );
};
