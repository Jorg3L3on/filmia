import { and, eq } from "drizzle-orm";
import { catalog, db, titles, type CatalogRow, type Platform, type TitleKind } from "@/db";
import { flattenTitle } from "@/lib/catalog";
import { getOwnedTitleIdByTmdb, resolvePreviewCatalog } from "@/lib/catalog-preview";
import { loadTitleById, loadTitles, loadWatchlist } from "@/lib/queries";
import { matchWatchProviderPlatform } from "@/lib/streaming-platforms";
import { parseStoredWatchProviders } from "@/lib/watch-providers";

/**
 * A person's library by state, and how a title reference resolves for them (FIL-I20-3). Built
 * on the same loaders as Quiero ver, the Diario and the ficha.
 */

export type LibraryStatus = "pending" | "watching" | "watched" | "saved";

export type LibraryFilter = {
  status?: LibraryStatus | "all";
  kind?: TitleKind;
  /** Streams (flatrate, MX) on this platform. */
  platform?: Platform;
  sort?: "recent" | "title" | "year" | "rating" | "watched" | "added";
};

/** Platforms a catalog row streams on in Mexico (flatrate only). */
export const streamingPlatformsOf = (watchProvidersMx: unknown): Platform[] => {
  const data = parseStoredWatchProviders(watchProvidersMx);
  const out = new Set<Platform>();
  for (const offer of data?.flatrate ?? []) {
    const platform = matchWatchProviderPlatform(offer);
    if (platform) out.add(platform);
  }
  return [...out];
};

/** A title's state for its owner: watched beats watching beats pending. */
export const libraryStatusOf = (
  title: { watchedAt: Date | null; seriesStatus: string | null },
  inWatchlist: boolean,
): LibraryStatus => {
  if (title.watchedAt) return "watched";
  if (title.seriesStatus === "WATCHING") return "watching";
  if (inWatchlist) return "pending";
  return "saved";
};

export const loadLibrary = async (userId: string, filter: LibraryFilter = {}) => {
  const sort = filter.sort ?? "recent";
  const [rows, watchlist] = await Promise.all([
    loadTitles(userId, {
      kind: filter.kind ?? "ALL",
      sort: sort === "title" ? "name" : sort === "added" ? "recent" : sort,
    }),
    loadWatchlist(userId),
  ]);
  const queue = new Map((watchlist?.items ?? []).map((item) => [item.catalogId, item]));

  const entries = rows
    .map((row) => {
      const pending = queue.get(row.catalogId);
      return {
        ...row,
        status: libraryStatusOf(row, Boolean(pending)),
        inWatchlist: Boolean(pending),
        addedToWatchlistAt: pending?.addedAt ?? null,
        queuePosition: pending?.position ?? null,
        queueNote: pending?.queueNote ?? null,
        streamingOn: streamingPlatformsOf(row.watchProvidersMx),
      };
    })
    .filter((entry) => !filter.status || filter.status === "all" || entry.status === filter.status)
    .filter((entry) => !filter.platform || entry.streamingOn.includes(filter.platform));

  if (sort === "added" || (filter.status === "pending" && sort === "recent")) {
    // Quiero ver keeps its own order: the position the person gave it.
    entries.sort((a, b) => (a.queuePosition ?? Infinity) - (b.queuePosition ?? Infinity));
  }
  return entries;
};

export type LibraryEntry = Awaited<ReturnType<typeof loadLibrary>>[number];

const TMDB_REF = /^tmdb:(movie|tv):(\d{1,9})$/;

export type ResolvedTitle = {
  catalog: CatalogRow;
  /** The person's own Title id, when the film is in their library. */
  titleId: string | null;
};

/**
 * `ref` is a catalog id (what Filmia returns) or `tmdb:movie:<id>` / `tmdb:tv:<id>`. A TMDB
 * film nobody saved yet gets its Catalog row like the ficha preview does. Null when unknown.
 */
export const resolveTitleRef = async (userId: string, ref: string): Promise<ResolvedTitle | null> => {
  const tmdb = TMDB_REF.exec(ref);
  let row: CatalogRow | null | undefined;
  if (tmdb) {
    const kind: TitleKind = tmdb[1] === "tv" ? "SERIES" : "MOVIE";
    row = await resolvePreviewCatalog(Number(tmdb[2]), kind);
  } else {
    row = await db.query.catalog.findFirst({ where: eq(catalog.id, ref) });
  }
  if (!row) return null;
  const titleId = await getOwnedTitleIdByTmdb(userId, row.tmdbId, row.kind);
  return { catalog: row, titleId };
};

/** The person's Title (flattened, with its own lists) for a resolved reference, if they have it. */
export const loadOwnTitle = async (userId: string, resolved: ResolvedTitle) =>
  resolved.titleId ? ((await loadTitleById(userId, resolved.titleId)) ?? null) : null;

/** Title id → catalog row for the person's own titles (writes that start from a Title id). */
export const loadOwnTitleRow = async (userId: string, titleId: string) => {
  const row = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    with: { catalog: true },
  });
  return row ? flattenTitle(row) : null;
};
