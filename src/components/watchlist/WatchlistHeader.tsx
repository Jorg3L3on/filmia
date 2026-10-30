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
import type { SavedViewsApi } from "@/components/watchlist/useSavedViews";
import { WatchlistScopeBar } from "@/components/watchlist/WatchlistScopeBar";
import { WatchlistViewsSheet } from "@/components/watchlist/WatchlistViewsSheet";
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
import { activeView, matchesView, openView, parseViewQuery, scopeOnly, viewQueryString } from "@/lib/watchlist-views";

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
  savedViews: SavedViewsApi;
};

/**
 * Quiero ver «Barra de decisión» (FIL-I34, option B): title with «N de total», Sorpréndeme and
 * the funnel; the Todo / Mis plataformas scope; the order pill and wrapping chips; one summary
 * line. Scrolling away leaves a 44 px bar with the title, the count, the order and the funnel.
 * Saved views (FIL-I34-6): the pinned one is a third scope cell, the summary line opens «Vistas»
 * and, once the person changes an open view, offers «Actualizar vista · Guardar como…».
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
  savedViews,
}: WatchlistHeaderProps) => {
  const [sheet, setSheet] = useState<"filters" | "order" | "genres" | "views" | "save" | null>(null);
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

  const { views } = savedViews;
  const pinnedView = views.find((view) => view.pinned) ?? null;
  const openedView = activeView(query, views);
  const viewChanged = openedView != null && !matchesView(query, openedView);
  const showView = (view: (typeof views)[number]) => {
    const next = openView(view);
    onChange(next.sort === "random" ? { ...next, seed: sessionSeed() } : next);
  };
  const vistasLink = (
    <button type="button" onClick={() => setSheet("views")} aria-haspopup="dialog" className={cn("qv-link", focusRing)}>
      {views.length > 0 ? `Vistas · ${views.length}` : "Guardar vista"}
    </button>
  );
  const offerViews = views.length > 0 || viewQueryString(query) !== "";

  const orderPill = (compact: boolean) => (
    <WatchlistOrderPill query={query} compact={compact} onOpen={() => setSheet("order")} onFlip={flip} />
  );

  // Actualizar vista (an open view changed) · Limpiar filtros (anything narrows) · Barajar otra vez
  // (Aleatoria) · Reordenar (Mi orden, nothing narrows).
  const summary = viewChanged && openedView ? (
    <span className="flex items-center gap-4">
      <button
        type="button"
        disabled={savedViews.pending}
        onClick={() => savedViews.update(openedView.id, viewQueryString(query))}
        aria-label={`Actualizar la vista ${openedView.name} con lo que ves`}
        className={cn("qv-link is-accent", focusRing)}
      >
        Actualizar vista
      </button>
      <button type="button" onClick={() => setSheet("save")} aria-haspopup="dialog" className={cn("qv-link", focusRing)}>
        Guardar como…
      </button>
    </span>
  ) : narrowed ? (
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
          pinned={
            pinnedView
              ? {
                  name: pinnedView.name,
                  count: count(parseViewQuery(pinnedView.query)),
                  selected: query.view === pinnedView.id,
                  onSelect: () => showView(pinnedView),
                }
              : null
          }
          // Leaving a view from the scope bar drops its filters too: Todo means the whole list.
          onChange={(scope) => onChange(query.view ? scopeOnly(scope) : { ...query, scope })}
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
        {summary || random || offerViews ? (
          <div className="flex min-h-6 items-center justify-between gap-3">
            {summary ?? <span />}
            <span className="flex items-center gap-4">
              {(narrowed || viewChanged) && random ? (
                <button type="button" onClick={() => onChange({ ...query, seed: sessionSeed(true) })} className={cn("qv-link", focusRing)}>
                  Barajar otra vez
                </button>
              ) : null}
              {offerViews && !viewChanged ? vistasLink : null}
            </span>
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
        <WatchlistViewsSheet
          open={sheet === "views" || sheet === "save"}
          startSaving={sheet === "save"}
          views={views}
          query={query}
          count={count}
          names={names}
          pending={savedViews.pending}
          onClose={close}
          onOpenView={(view) => {
            close();
            showView(view);
          }}
          onPin={(view, pinned) => savedViews.pin(view.id, pinned)}
          onRemove={(view) => {
            savedViews.remove(view.id);
            if (query.view === view.id) onChange({ ...query, view: null });
          }}
          onSave={(name, pin, done) =>
            savedViews.save(name, viewQueryString(query), pin, (result) => {
              if (!result.ok) return done(result.error);
              done(null);
              close();
              if (result.id) onChange({ ...query, view: result.id });
            })
          }
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
