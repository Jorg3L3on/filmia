import { parseOmdbAwards, awardChipLabel } from "@/lib/awards";
import { loadOwnTitle, resolveTitleRef, streamingPlatformsOf } from "@/lib/library";
import { loadWatchlist } from "@/lib/queries";
import { resolveTitlePeople } from "@/lib/title-people";
import { getWatchProvidersForTitle } from "@/lib/watch-providers-cache";

/**
 * Everything the ficha says about a title for one person (FIL-I20-3/4): the shared catalog row,
 * their own entry, people, where to watch in Mexico and awards. Same sources as the ficha page.
 */
export const loadTitleDetail = async (userId: string, ref: string) => {
  const resolved = await resolveTitleRef(userId, ref);
  if (!resolved) return null;
  const own = await loadOwnTitle(userId, resolved);
  const row = resolved.catalog;
  const [people, providers, watchlist] = await Promise.all([
    resolveTitlePeople({ catalogId: row.id, tmdbId: row.tmdbId, kind: row.kind, tmdbPeople: row.tmdbPeople }),
    getWatchProvidersForTitle({
      catalogId: row.id,
      tmdbId: row.tmdbId,
      kind: row.kind,
      watchProvidersMx: row.watchProvidersMx,
      watchProvidersFetchedAt: row.watchProvidersFetchedAt,
    }),
    own ? loadWatchlist(userId) : Promise.resolve(undefined),
  ]);
  const inWatchlist = Boolean(watchlist?.items.some((item) => item.catalogId === row.id));
  const status = own
    ? own.watchedAt
      ? ("watched" as const)
      : own.seriesStatus === "WATCHING"
        ? ("watching" as const)
        : inWatchlist
          ? ("pending" as const)
          : ("saved" as const)
    : ("not_in_library" as const);
  const awards = parseOmdbAwards(row.awards);
  return {
    catalog: row,
    titleId: resolved.titleId,
    own,
    status,
    inWatchlist,
    directors: people.filter((person) => person.role === "director" || person.role === "creator").map((person) => person.name),
    cast: people.filter((person) => person.role === "cast").slice(0, 8),
    providers: providers.data,
    streamingOn: streamingPlatformsOf(providers.data ?? row.watchProvidersMx),
    awards: awards ? { summary: awardChipLabel(row.awards), wins: awards.wins, nominations: awards.nominations } : null,
  };
};

export type TitleDetail = NonNullable<Awaited<ReturnType<typeof loadTitleDetail>>>;
