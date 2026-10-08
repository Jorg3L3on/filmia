import type { Platform, SeriesStatus, TitleKind } from "@/db";
import type { WatchlistItem } from "@/components/watchlist-types";
import { awardChipLabel } from "@/lib/awards";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { formatRuntime, PLATFORM_SERVICE_LABEL, TITLE_KIND_LABEL } from "@/lib/labels";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { resolvePosterAvailabilityBadge } from "@/lib/streaming-platforms";
import { titleSynopsis } from "@/lib/title-overview";
import { PINNED_REASON } from "@/lib/tonight/pin";
import type { TonightReason } from "@/lib/tonight/types";
import { toTonightTitle } from "@/lib/tonight-store";
import { creditParts, formatCredits, type CreditParts } from "@/lib/watchlist-credits";
import { fallbackReasons } from "@/lib/watchlist-hook";

/** Signals the page reads once per request (see `watchlist-hook-store.ts`). */
export type WatchlistSignals = {
  reasonsByTitle: ReadonlyMap<string, TonightReason[]>;
  snoozedUntilByTitle: ReadonlyMap<string, Date>;
  pinnedTitleId: string | null;
};

export type WatchlistFichaPlatform = {
  platform: Platform | null;
  label: string;
  /** Other brands that also stream it (shown as «+N»). */
  extraCount: number;
};

/** One Quiero ver row, serialisable (dates as ISO strings) for the client island. */
export type WatchlistFicha = {
  id: string;
  rank: number;
  name: string;
  kind: TitleKind;
  year: number | null;
  runtimeMinutes: number | null;
  /** «1982 · Película · 1 h 57 min». */
  meta: string;
  genres: string[];
  genreIds: number[];
  imdbRating: number | null;
  platform: WatchlistFichaPlatform | null;
  availableOnMine: boolean;
  awardLabel: string | null;
  /** Engine reasons (never fit/fit_over); the client adds the clock. */
  reasons: TonightReason[];
  overview: string | null;
  credits: string | null;
  /** The same credits, structured: each director / creator links to their filmography. */
  creditParts: CreditParts | null;
  queueNote: string | null;
  addedAt: string;
  availableSince: string | null;
  snoozedUntil: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  posterAmbient: string | null;
  rating: number | null;
  review: string | null;
  seriesStatus: SeriesStatus | null;
  seriesSeason: number | null;
};

export const GENRES_PER_FICHA = 3;

const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

const metaLine = (title: WatchlistItem["title"]) => {
  const parts: string[] = [];
  if (title.year) {
    parts.push(String(title.year));
  }
  parts.push(TITLE_KIND_LABEL[title.kind]);
  const runtime = formatRuntime(title.runtimeMinutes);
  if (runtime) {
    parts.push(title.kind === "SERIES" ? `${runtime} por capítulo` : runtime);
  }
  return parts.join(" · ");
};

const platformOf = (
  title: WatchlistItem["title"],
  userPlatforms: readonly Platform[],
): WatchlistFichaPlatform | null => {
  const badge = resolvePosterAvailabilityBadge(title.watchProvidersMx, userPlatforms);
  if (!badge) {
    return null;
  }
  const label = badge.platform
    ? PLATFORM_SERVICE_LABEL[badge.platform]
    : (badge.firstProvider?.name ?? null);
  return label ? { platform: badge.platform, label, extraCount: badge.extraCount } : null;
};

/** Top decile of the rated queue: above it the quality line says «entre lo mejor de tu lista». */
const qualityBarOf = (items: readonly WatchlistItem[]) => {
  const ratings = items
    .map((item) => item.title.imdbRating)
    .filter((rating): rating is number => rating != null)
    .sort((a, b) => b - a);
  if (ratings.length < 10) {
    return null;
  }
  return ratings[Math.floor(ratings.length / 10)] ?? null;
};

const NON_HOOK_KINDS = new Set(["fit", "fit_over"]);

export const buildWatchlistFichas = (
  items: readonly WatchlistItem[],
  options: { signals: WatchlistSignals; userPlatforms: readonly Platform[]; now: Date },
): WatchlistFicha[] => {
  const { signals, userPlatforms, now } = options;
  const qualityBar = qualityBarOf(items);

  return items.map((item, index) => {
    const { title } = item;
    const genres = parseStoredTmdbGenres(title.tmdbGenres);
    const tonightTitle = toTonightTitle(
      {
        ...title,
        listItems: [
          {
            position: item.position,
            addedAt: item.addedAt,
            queueNote: item.queueNote,
            list: { id: item.listId, slug: WATCHLIST_SLUG },
          },
        ],
      },
      userPlatforms,
    );
    const entry = {
      titleId: title.id,
      position: item.position,
      addedAt: item.addedAt,
      queueNote: item.queueNote,
    };

    const stored = signals.reasonsByTitle.get(title.id);
    const reasons = (stored ?? fallbackReasons(tonightTitle, entry, now, { qualityBar })).filter(
      (reason) => !NON_HOOK_KINDS.has(reason.kind),
    );
    if (signals.pinnedTitleId === title.id && !reasons.some((reason) => reason.kind === "pinned")) {
      reasons.unshift(PINNED_REASON);
    }

    return {
      id: title.id,
      rank: index + 1,
      name: title.name,
      kind: title.kind,
      year: title.year,
      runtimeMinutes: title.runtimeMinutes,
      meta: metaLine(title),
      genres: genres.slice(0, GENRES_PER_FICHA).map((genre) => genre.name),
      genreIds: genres.map((genre) => genre.id),
      imdbRating: title.imdbRating,
      platform: platformOf(title, userPlatforms),
      availableOnMine: tonightTitle.availableOnMine,
      awardLabel: awardChipLabel(title.awards),
      reasons,
      overview: titleSynopsis(title.overview),
      credits: formatCredits(tonightTitle.people, title.kind),
      creditParts: creditParts(tonightTitle.people, title.kind),
      queueNote: item.queueNote,
      addedAt: new Date(item.addedAt).toISOString(),
      availableSince: iso(title.availableSince),
      snoozedUntil: iso(signals.snoozedUntilByTitle.get(title.id) ?? null),
      posterPath: title.posterPath,
      backdropPath: title.backdropPath,
      posterAmbient: title.posterAmbient,
      rating: title.rating,
      review: title.review,
      seriesStatus: title.seriesStatus,
      seriesSeason: title.seriesSeason,
    };
  });
};
