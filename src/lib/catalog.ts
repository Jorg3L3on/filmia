import { and, eq } from "drizzle-orm";
import { catalog, db, type CatalogRow, type TitleKind } from "@/db";
import { catalogIdFor } from "@/lib/catalog-core";

export { catalogIdFor, flattenTitle, flattenTitles } from "@/lib/catalog-core";
export type { FlattenedTitle, RowWithCatalog } from "@/lib/catalog-core";

/** Relational `with` fragment for queries that need the flat `Title` shape. */
export const WITH_CATALOG = { catalog: true } as const;

export type CatalogSeed = {
  tmdbId: number;
  kind: TitleKind;
  /** Search snapshot; enrichment replaces it with TMDB's localized title. */
  name: string;
  originalName?: string | null;
  year?: number | null;
  posterPath?: string | null;
};

export const findCatalogByTmdb = (tmdbId: number, kind: TitleKind) =>
  db.query.catalog.findFirst({
    where: and(eq(catalog.tmdbId, tmdbId), eq(catalog.kind, kind)),
  });

/**
 * One shared row per film. The insert races safely: a concurrent save of the
 * same film hits the unique (tmdbId, kind) (and the deterministic id) and we
 * read the winner back. Existing rows are never overwritten here — the
 * catalog only changes through enrichment.
 */
export const findOrCreateCatalog = async (
  seed: CatalogSeed,
): Promise<{ row: CatalogRow; created: boolean }> => {
  const now = new Date();
  const inserted = await db
    .insert(catalog)
    .values({
      id: catalogIdFor(seed.kind, seed.tmdbId),
      tmdbId: seed.tmdbId,
      kind: seed.kind,
      name: seed.name.trim(),
      originalName: seed.originalName?.trim() || null,
      year: seed.year ?? null,
      posterPath: seed.posterPath ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  const created = inserted[0];
  if (created) {
    return { row: created, created: true };
  }

  const existing = await findCatalogByTmdb(seed.tmdbId, seed.kind);
  if (!existing) {
    throw new Error("No se pudo crear la ficha compartida.");
  }

  return { row: existing, created: false };
};
