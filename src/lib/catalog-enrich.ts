import { eq } from "drizzle-orm";
import { catalog, db, type CatalogRow } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import { catalogEnrichmentPatch, onlyMissingFields } from "@/lib/catalog-enrich-core";
import { resolveTitleMetadata } from "@/lib/metadata";
import { formatAmbientRgb } from "@/lib/poster-ambient";
import { sampleAmbientFromPosterPath } from "@/lib/poster-ambient-server";
import { revalidateTitlePages } from "@/lib/revalidate-surfaces";
import { scheduleTonightRecompute } from "@/lib/tonight-store";
import { enrichWatchProvidersOnSave } from "@/lib/watch-providers-cache";

export type CatalogEnrichTarget = Pick<CatalogRow, "id" | "tmdbId" | "kind" | "name">;

/**
 * Fill a catalog row from TMDB + OMDb (details, credits, keywords, ratings,
 * awards), MX availability and the poster ambient. Runs once per film: every
 * user who saves it afterwards gets the finished row for free.
 */
export const enrichCatalog = async (
  row: CatalogEnrichTarget,
  options: {
    /** Backfills pass the stored row: only its empty columns get filled. */
    onlyMissing?: Record<string, unknown>;
  } = {},
) => {
  const [resolved] = await Promise.all([
    resolveTitleMetadata(row.tmdbId, row.kind).catch(() => null),
    enrichWatchProvidersOnSave(row.id, row.tmdbId, row.kind),
  ]);

  if (!resolved) {
    return false;
  }

  const ambient = resolved.posterPath
    ? formatAmbientRgb(await sampleAmbientFromPosterPath(resolved.posterPath))
    : null;

  // Only fields that came back: a failed OMDb/TMDB lookup must not blank the shared row.
  const fresh = catalogEnrichmentPatch(resolved, { posterAmbient: ambient });
  const patch = options.onlyMissing ? onlyMissingFields(fresh, options.onlyMissing) : fresh;
  if (Object.keys(patch).length === 0) {
    return false;
  }

  await db.update(catalog).set(patch).where(eq(catalog.id, row.id));

  return true;
};

/**
 * Best-effort enrichment after the response. `userId`/`titleId` only drive the
 * follow-ups for the user who triggered it (their ficha, their Esta noche);
 * other users pick the data up on their next read.
 */
export const scheduleCatalogEnrichment = (
  row: CatalogEnrichTarget,
  follow: { userId?: string; titleId?: string } = {},
) => {
  scheduleAfterResponse(async () => {
    try {
      await enrichCatalog(row);
    } catch {
      // The catalog row exists with the search snapshot; enrichment is best-effort.
    }

    if (follow.titleId) {
      revalidateTitlePages(follow.titleId);
    }
    if (follow.userId) {
      scheduleTonightRecompute(follow.userId);
    }
  });
};
