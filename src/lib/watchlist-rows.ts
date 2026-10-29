import type { Platform } from "@/db";
import { awardChipLabel } from "@/lib/awards";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { matchWatchProviderPlatform } from "@/lib/streaming-platforms";
import { parseStoredPeople } from "@/lib/tonight-store";
import { parseStoredWatchProviders, type WatchProviderOffer } from "@/lib/watch-providers";
import type { WatchlistGenreCount, WatchlistRow } from "@/lib/watchlist-filters";

/**
 * Server side of FIL-I34: one `WatchlistRow` per item of Quiero ver, plus the names the
 * Filtros sheet shows (genres, languages, directors) with their whole-list counts.
 */

export type WatchlistRowSource = {
  addedAt: Date | string;
  queueNote: string | null;
  title: {
    id: string;
    name: string;
    kind: WatchlistRow["kind"];
    seriesStatus: WatchlistRow["seriesStatus"];
    platform: Platform | null;
    runtimeMinutes: number | null;
    year: number | null;
    imdbRating: number | null;
    imdbVotes: number | null;
    awards?: string | null;
    tmdbGenres: unknown;
    tmdbPeople: unknown;
    originalLanguage: string | null;
    availableSince: Date | string | null;
    watchProvidersMx: unknown;
  };
};

const platformsOf = (offers: readonly WatchProviderOffer[]) => [
  ...new Set(offers.map((offer) => matchWatchProviderPlatform(offer)).filter((platform) => platform != null)),
];

const time = (value: Date | string | null) => (value ? new Date(value).getTime() : null);

export const toWatchlistRow = (
  item: WatchlistRowSource,
  { userPlatforms, snoozedIds }: { userPlatforms: readonly Platform[]; snoozedIds: ReadonlySet<string> },
): WatchlistRow => {
  const { title } = item;
  const providers = parseStoredWatchProviders(title.watchProvidersMx);
  // Never checked against TMDB: the saved «Dónde la vi» is the best guess (same as the old filter).
  const flatrate = providers ? platformsOf(providers.flatrate) : title.platform ? [title.platform] : [];
  return {
    id: title.id,
    name: title.name,
    kind: title.kind,
    seriesStatus: title.seriesStatus,
    flatrate,
    rentBuy: providers ? platformsOf([...providers.rent, ...providers.buy]) : [],
    onMine: flatrate.some((platform) => userPlatforms.includes(platform)),
    providersUnknown: !providers && !title.platform,
    runtime: title.runtimeMinutes,
    year: title.year,
    imdb: title.imdbRating,
    votes: title.imdbVotes,
    genres: parseStoredTmdbGenres(title.tmdbGenres).map((genre) => genre.id),
    awarded: awardChipLabel(title.awards) != null,
    addedAt: time(item.addedAt) ?? 0,
    arrivedAt: time(title.availableSince),
    language: title.originalLanguage?.trim().toLowerCase() || null,
    snoozed: snoozedIds.has(title.id),
    hasNote: Boolean(item.queueNote?.trim()),
    people: parseStoredPeople(title.tmdbPeople)
      .filter((person) => person.role === (title.kind === "SERIES" ? "creator" : "director"))
      .map((person) => person.id),
  };
};

export type WatchlistPersonCount = { id: number; name: string; count: number };

const countBy = <K>(keys: Iterable<K>) => {
  const counts = new Map<K, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
};

const mostCommon = <T extends { count: number; name: string }>(items: T[]) =>
  items.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "es"));

/** Genres present in the list, most common first. */
export const genresInList = (items: readonly WatchlistRowSource[]): WatchlistGenreCount[] => {
  const names = new Map<number, string>();
  const ids: number[] = [];
  for (const item of items) {
    for (const genre of parseStoredTmdbGenres(item.title.tmdbGenres)) {
      names.set(genre.id, genre.name);
      ids.push(genre.id);
    }
  }
  return mostCommon([...countBy(ids)].map(([id, count]) => ({ id, name: names.get(id) ?? "", count })));
};

/** Directors and creators present in the list (only titles already enriched have them). */
export const peopleInList = (items: readonly WatchlistRowSource[]): WatchlistPersonCount[] => {
  const names = new Map<number, string>();
  const ids: number[] = [];
  for (const item of items) {
    const role = item.title.kind === "SERIES" ? "creator" : "director";
    for (const person of parseStoredPeople(item.title.tmdbPeople)) {
      if (person.role !== role) continue;
      names.set(person.id, person.name);
      ids.push(person.id);
    }
  }
  return mostCommon([...countBy(ids)].map(([id, count]) => ({ id, name: names.get(id) ?? "", count })));
};

/** Original languages present in the list, most common first (codes; the sheet names them). */
export const languagesInList = (rows: readonly WatchlistRow[]) =>
  [...countBy(rows.flatMap((row) => (row.language ? [row.language] : [])))]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));
