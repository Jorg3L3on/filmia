import { Suspense } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { WatchlistBodySkeleton } from "@/components/PageSkeletons";
import { WatchlistView } from "@/components/watchlist/WatchlistView";
import {
  getCurrentUserProfile,
  getUserStreamingPlatforms,
  getWatchlist,
} from "@/lib/queries";
import { scheduleMissingTitleOverviews } from "@/lib/title-overview-schedule";
import { loadSavedViews } from "@/lib/saved-views-store";
import { parseNightEnds } from "@/lib/tonight/time";
import { buildWatchlistFichas, type WatchlistSignals } from "@/lib/watchlist-ficha";
import { loadWatchlistSignals } from "@/lib/watchlist-hook-store";
import { genresInList, languagesInList, peopleInList, toWatchlistRow } from "@/lib/watchlist-rows";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quiero ver",
};

/** Desktop keeps the big page title; the phone header carries its own (FIL-I21-7, FIL-I34). */
const WatchlistDesktopTitle = () => (
  <div className="hidden sm:block">
    <PageHeader title="Quiero ver" />
  </div>
);

const EMPTY_SIGNALS: WatchlistSignals = {
  reasonsByTitle: new Map(),
  snoozedUntilByTitle: new Map(),
  pinnedTitleId: null,
};

/** Year slider bounds when the list has no years yet. */
const FIRST_YEAR = 1930;

// Scope, filters and order are read from the URL on the client (`useWatchlistQuery`), so the
// page never parses them: an old `?tonight=1` simply has nothing to match (FIL-I34-1).
export default function WatchlistPage() {
  return (
    <div className="space-y-5 max-sm:-mt-6 max-sm:space-y-1">
      <WatchlistDesktopTitle />
      <Suspense fallback={<WatchlistBodySkeleton />}>
        <WatchlistBody />
      </Suspense>
    </div>
  );
}

const WatchlistBody = async () => {
  const now = new Date();
  const [watchlist, userPlatforms, profile] = await Promise.all([
    getWatchlist(),
    getUserStreamingPlatforms(),
    getCurrentUserProfile(),
  ]);

  const items = watchlist?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        variant="watchlist"
        title="Aún no hay nada en Quiero ver"
        description="Añade títulos desde Buscar o desde una ficha."
        actionHref="/buscar"
        actionLabel="Ir a Buscar"
      />
    );
  }

  // Runtime too (FIL-I24-7): Cortas, Duración and «Más cortas» need it.
  scheduleMissingTitleOverviews(items.map((item) => item.title), { runtime: true });

  const [signals, savedViews] = profile
    ? await Promise.all([loadWatchlistSignals(profile.id, now), loadSavedViews(profile.id)])
    : [EMPTY_SIGNALS, []];
  const snoozedIds = new Set(signals.snoozedUntilByTitle.keys());
  const fichas = buildWatchlistFichas(items, { signals, userPlatforms, now });
  const rows = items.map((item) => toWatchlistRow(item, { userPlatforms, snoozedIds }));

  const years = rows.flatMap((row) => (row.year ? [row.year] : []));
  const decades = [...new Set(years.map((year) => Math.floor(year / 10) * 10))].sort((left, right) => left - right);

  return (
    <WatchlistView
      fichas={fichas}
      rows={rows}
      facets={{
        genres: genresInList(items),
        people: peopleInList(items),
        languages: languagesInList(rows),
        decades,
        years: { min: Math.min(FIRST_YEAR, ...years), max: Math.max(now.getFullYear(), ...years) },
      }}
      userPlatforms={userPlatforms}
      listId={watchlist?.id ?? ""}
      nightEnds={profile?.nightEnds ?? parseNightEnds(null)}
      pinnedTitleId={signals.pinnedTitleId}
      savedViews={savedViews}
      renderedAt={now.getTime()}
    />
  );
};
