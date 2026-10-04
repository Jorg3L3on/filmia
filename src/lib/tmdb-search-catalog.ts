import type { TitleKind } from "@/db";
import type { UserTmdbEntry } from "@/lib/queries";

export type TmdbCatalogEntry = {
  titleId: string;
  inWatchlist: boolean;
  watched: boolean;
};

export const tmdbCatalogKey = (tmdbId: number, kind: TitleKind) =>
  `${kind}:${tmdbId}`;

export const toTmdbCatalogMap = (entries: UserTmdbEntry[]) => {
  const next = new Map<string, TmdbCatalogEntry>();
  for (const entry of entries) {
    const mapped = {
      titleId: entry.titleId,
      inWatchlist: entry.inWatchlist,
      watched: entry.watched,
    };
    next.set(tmdbCatalogKey(entry.tmdbId, entry.kind), mapped);
    next.set(String(entry.tmdbId), mapped);
  }
  return next;
};

export const lookupTmdbCatalogEntry = (
  catalog: Map<string, TmdbCatalogEntry>,
  tmdbId: number,
  kind: TitleKind,
) => catalog.get(tmdbCatalogKey(tmdbId, kind)) ?? catalog.get(String(tmdbId)) ?? null;
