import { unstable_cache } from "next/cache";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, titles, type Platform, type TitleKind } from "@/db";
import { FAVORITAS_SLUG, WATCHLIST_SLUG } from "@/lib/lists";
import { fetchImdbScore } from "@/lib/omdb";
import {
  VOTE_COUNT_LADDER,
  YEAR_GRID_SIZE,
  pickYearGrid,
  yearGridNeedsFallback,
} from "@/lib/onboarding/year";
import { OMDB_CACHE_TAG, TMDB_CACHE_TAG } from "@/lib/rendering";
import { runPool } from "@/lib/run-pool";
import {
  matchWatchProviderPlatform,
  userStreamingProviderIds,
} from "@/lib/streaming-platforms";
import {
  discoverTmdb,
  getTmdbExternalIds,
  isTmdbConfigured,
  type TmdbDiscoverResult,
} from "@/lib/tmdb";
import { fetchMxWatchProviders } from "@/lib/watch-providers";
import { withTimeout } from "@/lib/with-timeout";

const LOOKUP_TIMEOUT_MS = 2500;
const SUGGESTIONS_SIZE = 18;

export type YearGridItem = {
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  /** OMDb score when it exists; new releases often have none yet. */
  imdbRating: number | null;
  /** TMDB average (0–10) as the fallback badge. */
  voteAverage: number | null;
  voteCount: number;
};

export type YearGrid = {
  year: number;
  items: YearGridItem[];
};

const toGridItem = (result: TmdbDiscoverResult): YearGridItem => ({
  tmdbId: result.tmdbId,
  kind: result.kind,
  name: result.name,
  originalName: result.originalName,
  year: result.year,
  posterPath: result.posterPath,
  imdbRating: null,
  voteAverage: result.voteAverage,
  voteCount: result.voteCount,
});

const discoverYear = async (year: number) => {
  const tiers = await Promise.all(
    VOTE_COUNT_LADDER.map((voteCountGte) =>
      discoverTmdb({ kind: "MOVIE", year, sortBy: "vote_count.desc", voteCountGte, region: "MX" }).catch(
        () => [] as TmdbDiscoverResult[],
      ),
    ),
  );
  return pickYearGrid(tiers).map(toGridItem);
};

/** IMDb score per tile, best effort: a slow or failing lookup just leaves the badge off. */
const attachImdbRatings = async (items: YearGridItem[]) => {
  await runPool(items, 4, async (item) => {
    const imdbId = await withTimeout(getTmdbExternalIds(item.tmdbId, item.kind), LOOKUP_TIMEOUT_MS, null);
    if (!imdbId) {
      return;
    }
    const score = await withTimeout(fetchImdbScore(imdbId), LOOKUP_TIMEOUT_MS, { rating: null, votes: null, awards: null });
    item.imdbRating = score.rating;
  });
  return items;
};

const buildYearGrid = async (year: number): Promise<YearGrid> => {
  if (!isTmdbConfigured()) {
    return { year, items: [] };
  }
  let items = await discoverYear(year);
  let shownYear = year;
  if (yearGridNeedsFallback(items)) {
    // Early in the year there is nothing voted yet: show last year's best instead.
    const previous = await discoverYear(year - 1);
    if (previous.length > items.length) {
      items = previous;
      shownYear = year - 1;
    }
  }
  return { year: shownYear, items: await attachImdbRatings(items.slice(0, YEAR_GRID_SIZE)) };
};

/** Public data, one computation per day shared by every new account. */
export const getOnboardingYearGrid = (year: number): Promise<YearGrid> =>
  unstable_cache(buildYearGrid, ["onboarding-year-grid", "v2"], {
    revalidate: 86400,
    tags: [TMDB_CACHE_TAG, OMDB_CACHE_TAG],
  })(year).catch(() => buildYearGrid(year));

export type SuggestionItem = {
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  platform: Platform | null;
};

const interleave = <T>(a: readonly T[], b: readonly T[]) => {
  const out: T[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    if (a[i]) out.push(a[i] as T);
    if (b[i]) out.push(b[i] as T);
  }
  return out;
};

const buildPlatformSuggestions = async (platformsKey: string): Promise<SuggestionItem[]> => {
  const platforms = platformsKey.split(",").filter(Boolean) as Platform[];
  const providerIds = userStreamingProviderIds(platforms);
  if (!isTmdbConfigured() || providerIds.length === 0) {
    return [];
  }
  const base = { withWatchProviders: providerIds, watchRegion: "MX", sortBy: "popularity.desc" as const, voteCountGte: 50 };
  const [movies, series] = await Promise.all([
    discoverTmdb({ ...base, kind: "MOVIE" }).catch(() => [] as TmdbDiscoverResult[]),
    discoverTmdb({ ...base, kind: "SERIES" }).catch(() => [] as TmdbDiscoverResult[]),
  ]);
  // Two movies per series: the sala is mostly films.
  const picked = interleave(movies.slice(0, 12), series.slice(0, 6)).slice(0, SUGGESTIONS_SIZE);
  const items: SuggestionItem[] = picked.map((result) => ({
    tmdbId: result.tmdbId,
    kind: result.kind,
    name: result.name,
    originalName: result.originalName,
    year: result.year,
    posterPath: result.posterPath,
    platform: null,
  }));
  // Which of *their* platforms carries it, for the corner logo. Best effort.
  await runPool(items, 4, async (item) => {
    const data = await withTimeout(fetchMxWatchProviders(item.tmdbId, item.kind), LOOKUP_TIMEOUT_MS, null);
    if (!data) {
      return;
    }
    for (const offer of data.flatrate) {
      const matched = matchWatchProviderPlatform(offer);
      if (matched && platforms.includes(matched)) {
        item.platform = matched;
        return;
      }
    }
  });
  return items;
};

/** Popular titles streaming flatrate on these platforms (MX). Cached per platform set, per day. */
export const getPlatformSuggestions = (platforms: readonly Platform[]): Promise<SuggestionItem[]> => {
  const key = [...new Set(platforms)].sort().join(",");
  return unstable_cache(buildPlatformSuggestions, ["onboarding-suggestions", "v1"], {
    revalidate: 86400,
    tags: [TMDB_CACHE_TAG],
  })(key).catch(() => buildPlatformSuggestions(key));
};

export type LibraryEntry = {
  titleId: string;
  tmdbId: number;
  kind: TitleKind;
  name: string;
  year: number | null;
  posterPath: string | null;
  posterAmbient: string | null;
  watched: boolean;
  rating: number | null;
  inWatchlist: boolean;
  inFavoritas: boolean;
  createdAt: string;
};

/** Everything the flow needs to resume: the user's TMDB-backed titles with list membership. */
export const getOnboardingLibrary = async (userId: string): Promise<LibraryEntry[]> => {
  const rows = await db.query.titles.findMany({
    where: and(eq(titles.userId, userId), isNotNull(titles.tmdbId)),
    columns: {
      id: true,
      tmdbId: true,
      kind: true,
      name: true,
      year: true,
      posterPath: true,
      posterAmbient: true,
      watchedAt: true,
      rating: true,
      createdAt: true,
    },
    with: { listItems: { with: { list: { columns: { slug: true } } } } },
  });
  return rows.flatMap((row) => {
    if (row.tmdbId == null) {
      return [];
    }
    const slugs = row.listItems.map((item) => item.list.slug);
    return [
      {
        titleId: row.id,
        tmdbId: row.tmdbId,
        kind: row.kind,
        name: row.name,
        year: row.year,
        posterPath: row.posterPath,
        posterAmbient: row.posterAmbient,
        watched: row.watchedAt != null,
        rating: row.rating,
        inWatchlist: slugs.includes(WATCHLIST_SLUG),
        inFavoritas: slugs.includes(FAVORITAS_SLUG),
        createdAt: row.createdAt.toISOString(),
      },
    ];
  });
};
