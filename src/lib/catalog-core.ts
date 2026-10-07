import { createHash } from "node:crypto";
import type { CatalogFields, CatalogRow, TitleKind, UserTitle } from "@/db";

/**
 * Catalog ids are a function of the film: the same scheme migration 0009 used
 * (`md5(kind || ':' || tmdbId)`), so backfilled and app-created rows agree and
 * a concurrent insert of the same film collides on the primary key as well as
 * on the unique (tmdbId, kind).
 */
export const catalogIdFor = (kind: TitleKind, tmdbId: number) =>
  createHash("md5").update(`${kind}:${tmdbId}`).digest("hex");

export type RowWithCatalog<T> = T & { catalog: CatalogRow | null };

export type FlattenedTitle<T> = Omit<T, "catalog"> & CatalogFields & { catalogId: string };

/**
 * Spread the shared catalog over the personal row. Catalog fields win over the
 * (stale) metadata columns still on `Title` until 0010; `id`, `createdAt`,
 * `updatedAt` and every personal field stay the Title's.
 *
 * A row without a catalog can only exist before 0009 ran; it is returned as is
 * so the app degrades to the old per-user metadata instead of crashing.
 */
export const flattenTitle = <T extends UserTitle>(row: RowWithCatalog<T>): FlattenedTitle<T> => {
  const { catalog: shared, ...personal } = row;
  if (!shared) {
    return personal as unknown as FlattenedTitle<T>;
  }

  const fields: Partial<CatalogRow> = { ...shared };
  delete fields.id;
  delete fields.createdAt;
  delete fields.updatedAt;
  return { ...personal, ...fields, catalogId: shared.id } as FlattenedTitle<T>;
};

export const flattenTitles = <T extends UserTitle>(rows: RowWithCatalog<T>[]) =>
  rows.map((row) => flattenTitle(row));
