import { and, eq } from "drizzle-orm";
import { cache } from "react";
import { catalog, db, titles, type CatalogRow, type TitleKind } from "@/db";
import { findCatalogByTmdb, findOrCreateCatalog, flattenTitle } from "@/lib/catalog";
import { catalogEnrichmentPatch, onlyMissingFields } from "@/lib/catalog-enrich-core";
import { scheduleCatalogEnrichment } from "@/lib/catalog-enrich";
import { resolveTitleMetadata, type TitleMetadata } from "@/lib/metadata";
import { getTmdbDetails, isTmdbConfigured } from "@/lib/tmdb";
import { catalogNeedsEnrichment } from "@/lib/title-preview";

/** The user's Title for this film, when they already have it (the preview then redirects). */
export const getOwnedTitleIdByTmdb = cache(
  async (userId: string, tmdbId: number, kind: TitleKind): Promise<string | null> => {
    const [row] = await db
      .select({ id: titles.id })
      .from(titles)
      .innerJoin(catalog, eq(titles.catalogId, catalog.id))
      .where(and(eq(titles.userId, userId), eq(catalog.tmdbId, tmdbId), eq(catalog.kind, kind)))
      .limit(1);
    return row?.id ?? null;
  },
);

/**
 * The shared row behind a preview. A film nobody saved yet gets its Catalog row
 * from TMDB details (cached a day) so the hero has what it needs; enrichment
 * (OMDb, MX availability, ambient) runs after the response, once per film.
 * Null when TMDB does not know the id.
 */
export const resolvePreviewCatalog = cache(
  async (tmdbId: number, kind: TitleKind): Promise<CatalogRow | null> => {
    const existing = await findCatalogByTmdb(tmdbId, kind);
    if (existing) {
      if (catalogNeedsEnrichment(existing)) {
        scheduleCatalogEnrichment(existing);
      }
      return existing;
    }

    if (!isTmdbConfigured()) {
      return null;
    }

    const details = await getTmdbDetails(tmdbId, kind).catch(() => null);
    if (!details?.name) {
      return null;
    }

    const { row } = await findOrCreateCatalog({
      tmdbId,
      kind,
      name: details.name,
      originalName: details.originalName,
      year: details.year,
      posterPath: details.posterPath,
    });
    if (catalogNeedsEnrichment(row)) {
      scheduleCatalogEnrichment(row);
    }
    return row;
  },
);

/**
 * What the hero still lacks on a snapshot row (IMDb, awards, runtime, genres):
 * the same cached TMDB + OMDb lookups enrichment makes, awaited inside a
 * Suspense boundary so the first paint never waits for OMDb.
 */
export const resolvePreviewMetadata = cache(
  async (row: CatalogRow): Promise<TitleMetadata | null> =>
    catalogNeedsEnrichment(row) ? resolveTitleMetadata(row.tmdbId, row.kind).catch(() => null) : null,
);

/**
 * The flat Title shape the ficha sections read, with nothing personal: no id
 * of the user's, no rating, not watched, in no list.
 */
export const previewTitleFromCatalog = (row: CatalogRow) => {
  const flat = flattenTitle({
    id: "",
    userId: "",
    catalogId: row.id,
    rating: null,
    impliedRating: null,
    review: null,
    platform: null,
    watchedAt: null,
    seriesStatus: null,
    seriesSeason: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    catalog: row,
  });
  return { ...flat, listItems: [] as never[] };
};

export type PreviewTitle = ReturnType<typeof previewTitleFromCatalog>;

/** The preview with the streamed lookup laid under it: stored values always win. */
export const withPreviewMetadata = (
  title: PreviewTitle,
  metadata: TitleMetadata | null,
): PreviewTitle => {
  if (!metadata) {
    return title;
  }
  const missing = onlyMissingFields(catalogEnrichmentPatch(metadata), title as Record<string, unknown>);
  return { ...title, ...missing };
};
