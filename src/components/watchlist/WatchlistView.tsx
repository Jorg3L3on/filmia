"use client";

import { useMemo } from "react";
import type { Platform } from "@/db";
import { MinePlatformsSetupCta, MissingStreamingDataNote } from "@/components/MinePlatformsNotice";
import { useWatchlistQuery } from "@/components/watchlist/useWatchlistQuery";
import { WatchlistCartelera } from "@/components/watchlist/WatchlistCartelera";
import { WatchlistEditingProvider, useWatchlistEditing } from "@/components/watchlist/WatchlistEditing";
import { WatchlistEmpty } from "@/components/watchlist/WatchlistEmpty";
import type { WatchlistFacetData } from "@/components/watchlist/WatchlistFiltersSheet";
import { WatchlistHeader } from "@/components/watchlist/WatchlistHeader";
import { WatchlistOfflineNote } from "@/components/watchlist/WatchlistOfflineNote";
import type { NightEnds } from "@/lib/tonight/types";
import { watchlistEmptyCopy, watchlistExits } from "@/lib/watchlist-empty";
import { makeWatchlistCounter } from "@/lib/watchlist-facets";
import type { WatchlistFicha } from "@/lib/watchlist-ficha";
import { filterRows, scopeCounts, sortRows, type WatchlistRow } from "@/lib/watchlist-filters";
import { activeFilterCount } from "@/lib/watchlist-query";

type WatchlistViewProps = {
  /** The whole list, manual order. */
  fichas: WatchlistFicha[];
  rows: WatchlistRow[];
  facets: WatchlistFacetData;
  userPlatforms: Platform[];
  listId: string;
  nightEnds: NightEnds;
  pinnedTitleId: string | null;
  /** Server clock (epoch ms): «Agregada» windows and the offline note's «de hoy, 6:40 p. m.». */
  renderedAt: number;
};

/**
 * Quiero ver (FIL-I34): the header decides, the cartelera shows. The whole list comes once;
 * scope, filters and order run here on the client, so «Ver N», the counts and the list always
 * agree, and they keep working offline.
 */
export const WatchlistView = (props: WatchlistViewProps) => (
  <WatchlistEditingProvider canReorder={props.rows.length > 1}>
    <WatchlistViewBody {...props} />
  </WatchlistEditingProvider>
);

const WatchlistViewBody = ({
  fichas,
  rows,
  facets,
  userPlatforms,
  listId,
  nightEnds,
  pinnedTitleId,
  renderedAt,
}: WatchlistViewProps) => {
  const { query, setQuery } = useWatchlistQuery();
  const editing = useWatchlistEditing();
  const context = useMemo(() => ({ now: renderedAt }), [renderedAt]);
  const count = useMemo(() => makeWatchlistCounter(rows, context), [rows, context]);
  const names = useMemo(
    () => ({
      genres: new Map(facets.genres.map((genre) => [genre.id, genre.name])),
      people: new Map(facets.people.map((person) => [person.id, person.name])),
    }),
    [facets],
  );
  const displayIds = useMemo(
    () => sortRows(filterRows(rows, query, context), query).map((row) => row.id),
    [rows, query, context],
  );
  const totals = useMemo(() => scopeCounts(rows), [rows]);
  const needsSetup = query.scope === "mine" && userPlatforms.length === 0;
  const unknownProviders = query.scope === "mine" ? rows.filter((row) => row.providersUnknown).length : 0;
  const filters = activeFilterCount(query);
  const paused = filters > 0 || query.sort !== null || query.scope === "mine" ? { filters: filters + (query.scope === "mine" ? 1 : 0), order: query.sort !== null } : null;

  return (
    <div className="space-y-4">
      <WatchlistHeader
        query={query}
        onChange={setQuery}
        shown={needsSetup ? 0 : displayIds.length}
        rows={rows}
        scopeCounts={totals}
        userPlatforms={userPlatforms}
        facets={facets}
        names={names}
        context={context}
        count={count}
      />
      <WatchlistOfflineNote renderedAt={renderedAt} />
      {needsSetup && !editing?.isEditing ? (
        <MinePlatformsSetupCta />
      ) : (
        <>
          {editing?.isEditing ? null : <MissingStreamingDataNote count={unknownProviders} />}
          <WatchlistCartelera
            fichas={fichas}
            displayIds={displayIds}
            listId={listId}
            nightEnds={nightEnds}
            pinnedTitleId={pinnedTitleId}
            order={query}
            paused={paused}
            emptyState={
              <WatchlistEmpty
                copy={watchlistEmptyCopy(query, rows.length, names)}
                exits={watchlistExits(query, count, names)}
                onPick={setQuery}
              />
            }
          />
        </>
      )}
    </div>
  );
};
