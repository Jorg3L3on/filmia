import { and, asc, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { catalog, db, serviceCharts, titles, type Platform, type TitleKind } from "@/db";
import { findOrCreateCatalog } from "@/lib/catalog";
import { enrichCatalog } from "@/lib/catalog-enrich";
import { addDays, mxToday } from "@/lib/cine-core";
import { ensureReadableTitle, needsEnrichment } from "@/lib/cine-store";
import { PLATFORMS } from "@/lib/labels";
import {
  collectLatestWeek,
  dedupeShows,
  expectedLatestWeekEnd,
  isOfficialListUsable,
  matchCandidates,
  NETFLIX_TOP10_URL,
  streamLines,
  weekStartOf,
  type Top10Row,
} from "@/lib/netflix-top10";
import { arrivalPlatform } from "@/lib/platform-arrivals";
import { runPool } from "@/lib/run-pool";
import {
  ARRIVALS_LIMIT,
  ARRIVALS_WINDOW_DAYS,
  CHART_KINDS,
  CHART_SIZE,
  parseChartSource,
  snapshotRows,
  type ArrivalTitle,
  type ChartEntry,
  type ServiceChart,
} from "@/lib/service-charts";
import { matchWatchProviderPlatform, STREAMING_PLATFORM_TMDB } from "@/lib/streaming-platforms";
import { discoverTmdb, searchTmdbTitlesEn, type TmdbDiscoverResult } from "@/lib/tmdb";
import { fetchMxWatchProviders } from "@/lib/watch-providers";

/** New Catalog rows enriched per run: enrichment spends the shared OMDb budget. */
const MAX_ENRICH_PER_RUN = 30;

const DISCOVER_CONCURRENCY = 3;

/** An official list older than this (days from its week start) gives way to popularity again. */
const OFFICIAL_FRESH_DAYS = 16;

type Budget = { left: number; enriched: number };

export type ServiceChartsRunSummary = {
  lists: number;
  rows: number;
  /** Catalog rows this run created. */
  created: number;
  /** Lists left as they were because a fresh official list holds them. */
  kept: string[];
  enriched: number;
  /** `PLATFORM/KIND` lists that came back short (fewer than 10) or failed. */
  short: string[];
  failed: string[];
};

/** One discover result → its shared Catalog row (never overwritten), enriched within the budget. */
const materialize = async (
  result: Pick<TmdbDiscoverResult, "tmdbId" | "name" | "originalName" | "year" | "posterPath">,
  kind: TitleKind,
  budget: Budget,
) => {
  const { row, created } = await findOrCreateCatalog({
    tmdbId: result.tmdbId,
    kind,
    name: result.name,
    originalName: result.originalName,
    year: result.year,
    posterPath: result.posterPath,
  });
  if (kind === "MOVIE") {
    await ensureReadableTitle(row).catch(() => null);
  }
  if ((created || needsEnrichment(row)) && budget.left > 0) {
    budget.left -= 1;
    try {
      if (await enrichCatalog(row)) {
        budget.enriched += 1;
      }
    } catch {
      // The row stands with the discover snapshot; a later run enriches it.
    }
  }
  return { catalogId: row.id, created };
};

/** One platform and kind: discover → Catalog rows → replace the stored snapshot. */
const refreshOne = async (platform: Platform, kind: TitleKind, period: string, budget: Budget, now: Date) => {
  const previousRows = await db
    .select({ catalogId: serviceCharts.catalogId, rank: serviceCharts.rank, source: serviceCharts.source, period: serviceCharts.period })
    .from(serviceCharts)
    .where(and(eq(serviceCharts.platform, platform), eq(serviceCharts.kind, kind)));
  // A fresh official list (Netflix, FIL-I47-2) wins over popularity until it is two weeks stale.
  if (previousRows.length > 0 && previousRows.every((row) => row.source === "official" && row.period >= addDays(period, -OFFICIAL_FRESH_DAYS))) {
    return { rows: previousRows.length, created: 0, kept: true };
  }
  const comparable = previousRows.filter((row) => row.source === "popularity");

  const results = await discoverTmdb({
    kind,
    sortBy: "popularity.desc",
    withWatchProviders: STREAMING_PLATFORM_TMDB[platform].providerIds,
    watchRegion: "MX",
    watchMonetizationTypes: "flatrate",
  });

  const entries: ChartEntry[] = [];
  let created = 0;
  // In order, one at a time: the rank is the discover position.
  for (const result of results) {
    if (entries.length >= CHART_SIZE) break;
    if (!result.posterPath) continue;
    const materialized = await materialize(result, kind, budget);
    if (materialized.created) created += 1;
    entries.push({ catalogId: materialized.catalogId });
  }

  const rows = snapshotRows(entries, new Map(comparable.map((row) => [row.catalogId, row.rank])));
  if (rows.length === 0) {
    // An empty answer never wipes the list people saw yesterday.
    return { rows: 0, created, kept: false };
  }

  await db.batch([
    db.delete(serviceCharts).where(and(eq(serviceCharts.platform, platform), eq(serviceCharts.kind, kind))),
    db.insert(serviceCharts).values(
      rows.map((row) => ({
        platform,
        kind,
        rank: row.rank,
        catalogId: row.catalogId,
        source: "popularity",
        period,
        previousRank: row.previousRank,
        weeksOnList: null,
        computedAt: now,
      })),
    ),
  ]);
  return { rows: rows.length, created, kept: false };
};

/**
 * Nightly step (FIL-I47-1): for every supported platform, TMDB discover MX flatrate by popularity,
 * films and series apart; keeps the first ten with a poster. TMDB is called here only — Hoy reads
 * the table.
 */
export const refreshServiceCharts = async (
  options: { platforms?: readonly Platform[]; now?: Date } = {},
): Promise<ServiceChartsRunSummary> => {
  const now = options.now ?? new Date();
  const period = mxToday(now);
  const budget: Budget = { left: MAX_ENRICH_PER_RUN, enriched: 0 };
  const jobs = (options.platforms ?? PLATFORMS).flatMap((platform) => CHART_KINDS.map((kind) => ({ platform, kind })));
  const summary: ServiceChartsRunSummary = { lists: 0, rows: 0, created: 0, kept: [], enriched: 0, short: [], failed: [] };

  await runPool(jobs, DISCOVER_CONCURRENCY, async ({ platform, kind }) => {
    const label = `${platform}/${kind}`;
    try {
      const result = await refreshOne(platform, kind, period, budget, now);
      if (result.kept) {
        summary.kept.push(label);
        return;
      }
      summary.rows += result.rows;
      summary.created += result.created;
      if (result.rows > 0) summary.lists += 1;
      if (result.rows < CHART_SIZE) summary.short.push(`${label}:${result.rows}`);
    } catch {
      summary.failed.push(label);
    }
  });

  summary.enriched = budget.enriched;
  summary.short.sort();
  summary.failed.sort();
  return summary;
};

export type NetflixImportKindSummary = { rows: number; matched: number; written: boolean; unmatched: string[] };

export type NetflixImportSummary =
  | { ok: true; skipped: "up_to_date"; week: string }
  | { ok: false; error: "fetch_failed" | "file_empty" }
  | { ok: true; week: string; films: NetflixImportKindSummary; series: NetflixImportKindSummary };

/** The first hit that streams on Netflix MX (flatrate), among up to three exact-name candidates. */
const matchOnNetflix = async (row: Top10Row) => {
  const candidates = matchCandidates(row.showTitle, await searchTmdbTitlesEn(row.showTitle, row.kind)).slice(0, 3);
  for (const candidate of candidates) {
    const providers = await fetchMxWatchProviders(candidate.tmdbId, row.kind).catch(() => null);
    if (providers?.flatrate.some((offer) => matchWatchProviderPlatform(offer) === "NETFLIX")) {
      return candidate;
    }
  }
  return null;
};

const importKind = async (
  rows: readonly Top10Row[],
  kind: TitleKind,
  weekStart: string,
  budget: Budget,
  now: Date,
): Promise<NetflixImportKindSummary> => {
  const ofKind = dedupeShows(rows.filter((row) => row.kind === kind));
  const matched: { rank: number; catalogId: string; weeks: number }[] = [];
  const unmatched: string[] = [];
  for (const row of ofKind) {
    try {
      const hit = await matchOnNetflix(row);
      if (!hit) {
        unmatched.push(`${row.rank}. ${row.showTitle}`);
        continue;
      }
      const { catalogId } = await materialize(
        { tmdbId: hit.tmdbId, name: hit.enName, originalName: hit.originalName, year: hit.year, posterPath: hit.posterPath },
        kind,
        budget,
      );
      if (matched.some((entry) => entry.catalogId === catalogId)) continue;
      matched.push({ rank: row.rank, catalogId, weeks: row.weeks });
    } catch {
      unmatched.push(`${row.rank}. ${row.showTitle}`);
    }
  }

  if (!isOfficialListUsable(matched.length)) {
    // Too few to call it the official list: Netflix keeps «Lo más popular».
    return { rows: ofKind.length, matched: matched.length, written: false, unmatched };
  }

  const previous = await db
    .select({ catalogId: serviceCharts.catalogId, rank: serviceCharts.rank, source: serviceCharts.source })
    .from(serviceCharts)
    .where(and(eq(serviceCharts.platform, "NETFLIX"), eq(serviceCharts.kind, kind)));
  const previousRank = new Map(previous.filter((row) => row.source === "official").map((row) => [row.catalogId, row.rank]));

  await db.batch([
    db.delete(serviceCharts).where(and(eq(serviceCharts.platform, "NETFLIX"), eq(serviceCharts.kind, kind))),
    db.insert(serviceCharts).values(
      matched.map((entry) => ({
        platform: "NETFLIX" as const,
        kind,
        rank: entry.rank,
        catalogId: entry.catalogId,
        source: "official",
        period: weekStart,
        previousRank: previousRank.get(entry.catalogId) ?? null,
        weeksOnList: entry.weeks,
        computedAt: now,
      })),
    ),
  ]);
  return { rows: ofKind.length, matched: matched.length, written: true, unmatched };
};

/**
 * Weekly step (FIL-I47-2): Netflix's own Top 10 for Mexico, films and series. Downloads the file
 * (streamed, MX rows of the latest week only) once a newer week should be out; titles are matched
 * to TMDB by English name among those streaming on Netflix MX. Unmatched rows are skipped and
 * reported; under six matches a kind keeps the popularity list.
 */
export const importNetflixTop10 = async (
  options: { now?: Date; force?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<NetflixImportSummary> => {
  const now = options.now ?? new Date();
  const today = mxToday(now);
  const expectedStart = weekStartOf(expectedLatestWeekEnd(today));
  if (!options.force) {
    const [stored] = await db
      .select({ period: serviceCharts.period })
      .from(serviceCharts)
      .where(and(eq(serviceCharts.platform, "NETFLIX"), eq(serviceCharts.source, "official")))
      .orderBy(desc(serviceCharts.period))
      .limit(1);
    if (stored && stored.period >= expectedStart) {
      return { ok: true, skipped: "up_to_date", week: stored.period };
    }
  }

  let rows: Top10Row[];
  try {
    const response = await (options.fetchImpl ?? fetch)(NETFLIX_TOP10_URL, { cache: "no-store" });
    if (!response.ok || !response.body) {
      return { ok: false, error: "fetch_failed" };
    }
    rows = await collectLatestWeek(streamLines(response.body as unknown as AsyncIterable<Uint8Array>), "MX");
  } catch {
    return { ok: false, error: "fetch_failed" };
  }
  if (rows.length === 0) {
    return { ok: false, error: "file_empty" };
  }

  const weekStart = weekStartOf(rows[0]!.week);
  const budget: Budget = { left: MAX_ENRICH_PER_RUN, enriched: 0 };
  const films = await importKind(rows, "MOVIE", weekStart, budget, now);
  const series = await importKind(rows, "SERIES", weekStart, budget, now);
  return { ok: true, week: weekStart, films, series };
};

/** The stored lists for these platforms, ranks in order. Empty before 0027 is applied. */
export const getServiceCharts = async (platforms: readonly Platform[]): Promise<ServiceChart[]> => {
  if (platforms.length === 0) {
    return [];
  }
  let rows;
  try {
    rows = await db
      .select({
        platform: serviceCharts.platform,
        kind: serviceCharts.kind,
        rank: serviceCharts.rank,
        source: serviceCharts.source,
        period: serviceCharts.period,
        previousRank: serviceCharts.previousRank,
        weeksOnList: serviceCharts.weeksOnList,
        catalogId: catalog.id,
        tmdbId: catalog.tmdbId,
        name: catalog.name,
        originalName: catalog.originalName,
        year: catalog.year,
        posterPath: catalog.posterPath,
      })
      .from(serviceCharts)
      .innerJoin(catalog, eq(catalog.id, serviceCharts.catalogId))
      .where(inArray(serviceCharts.platform, [...platforms]))
      .orderBy(asc(serviceCharts.platform), asc(serviceCharts.kind), asc(serviceCharts.rank));
  } catch {
    return [];
  }

  const charts = new Map<string, ServiceChart>();
  for (const row of rows) {
    const key = `${row.platform}:${row.kind}`;
    let chart = charts.get(key);
    if (!chart) {
      chart = { platform: row.platform, kind: row.kind, source: parseChartSource(row.source), period: row.period, titles: [] };
      charts.set(key, chart);
    }
    chart.titles.push({
      catalogId: row.catalogId,
      tmdbId: row.tmdbId,
      kind: row.kind,
      name: row.name,
      originalName: row.originalName,
      year: row.year,
      posterPath: row.posterPath,
      rank: row.rank,
      previousRank: row.previousRank,
      weeksOnList: row.weeksOnList,
    });
  }
  return [...charts.values()];
};

/**
 * «Recién llegó»: catalogued titles whose flatrate MX offer appeared in the last week on one of
 * the user's platforms, minus what the user already watched. Newest first.
 */
export const getRecentArrivals = async (
  userId: string,
  platforms: readonly Platform[],
  now = new Date(),
): Promise<ArrivalTitle[]> => {
  if (platforms.length === 0) {
    return [];
  }
  const since = new Date(now.getTime() - ARRIVALS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [rows, watched] = await Promise.all([
    db
      .select({
        catalogId: catalog.id,
        tmdbId: catalog.tmdbId,
        kind: catalog.kind,
        name: catalog.name,
        originalName: catalog.originalName,
        year: catalog.year,
        posterPath: catalog.posterPath,
        availableSince: catalog.availableSince,
        watchProvidersMx: catalog.watchProvidersMx,
      })
      .from(catalog)
      .where(and(isNotNull(catalog.availableSince), gte(catalog.availableSince, since)))
      .orderBy(desc(catalog.availableSince))
      .limit(200),
    db
      .select({ catalogId: titles.catalogId })
      .from(titles)
      .where(and(eq(titles.userId, userId), isNotNull(titles.watchedAt))),
  ]);
  const seen = new Set(watched.map((row) => row.catalogId));

  const arrivals: ArrivalTitle[] = [];
  for (const row of rows) {
    if (arrivals.length >= ARRIVALS_LIMIT) break;
    if (!row.availableSince || row.availableSince > now || seen.has(row.catalogId)) continue;
    const platform = arrivalPlatform(row.watchProvidersMx, platforms);
    if (!platform) continue;
    arrivals.push({
      catalogId: row.catalogId,
      tmdbId: row.tmdbId,
      kind: row.kind,
      name: row.name,
      originalName: row.originalName,
      year: row.year,
      posterPath: row.posterPath,
      platform,
      availableSince: row.availableSince.toISOString(),
    });
  }
  return arrivals;
};
