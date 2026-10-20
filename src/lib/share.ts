import { asc, eq, sql } from "drizzle-orm";
import { cache } from "react";
import { catalog, db, listItems, lists, titles } from "@/db";
import { verifyShareToken } from "@/lib/share-token";

/**
 * What a public share page may read (FIL-I15-4). Explicit columns only: never
 * the owner, their email, platform, watch date or notes. A list never
 * includes «Quiero ver» queue notes.
 */

export type SharedReview = {
  name: string;
  originalName: string | null;
  year: number | null;
  kind: "MOVIE" | "SERIES";
  posterPath: string | null;
  backdropPath: string | null;
  /** 0–10 (half stars). */
  rating: number | null;
  review: string | null;
};

export type SharedListTitle = {
  name: string;
  year: number | null;
  kind: "MOVIE" | "SERIES";
  posterPath: string | null;
};

export type SharedList = {
  name: string;
  description: string | null;
  /** All titles in the list; `titles` stops at SHARED_LIST_LIMIT. */
  total: number;
  titles: SharedListTitle[];
};

/** Most a shared list shows (the OG card uses the first few). */
export const SHARED_LIST_LIMIT = 60;

export const getSharedReview = cache(async (token: string): Promise<SharedReview | null> => {
  const id = verifyShareToken("resena", token);
  if (!id) {
    return null;
  }
  const [row] = await db
    .select({
      name: catalog.name,
      originalName: catalog.originalName,
      year: catalog.year,
      kind: catalog.kind,
      posterPath: catalog.posterPath,
      backdropPath: catalog.backdropPath,
      rating: titles.rating,
      review: titles.review,
    })
    .from(titles)
    .innerJoin(catalog, eq(titles.catalogId, catalog.id))
    .where(eq(titles.id, id))
    .limit(1);
  if (!row) {
    return null;
  }
  return { ...row, review: row.review?.trim() || null };
});

export const getSharedList = cache(async (token: string): Promise<SharedList | null> => {
  const id = verifyShareToken("lista", token);
  if (!id) {
    return null;
  }
  const [list] = await db
    .select({ name: lists.name, description: lists.description })
    .from(lists)
    .where(eq(lists.id, id))
    .limit(1);
  if (!list) {
    return null;
  }
  const [rows, [counted]] = await Promise.all([
    db
      .select({
        name: catalog.name,
        year: catalog.year,
        kind: catalog.kind,
        posterPath: catalog.posterPath,
      })
      .from(listItems)
      .innerJoin(catalog, eq(listItems.catalogId, catalog.id))
      .where(eq(listItems.listId, id))
      .orderBy(asc(listItems.position), asc(catalog.name))
      .limit(SHARED_LIST_LIMIT),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(listItems)
      .where(eq(listItems.listId, id)),
  ]);
  return {
    name: list.name,
    description: list.description?.trim() || null,
    total: counted?.total ?? rows.length,
    titles: rows,
  };
});

/** Absolute base for the share pages' OG tags: the host the link was opened on. */
export const shareMetadataBase = async () => {
  const { headers } = await import("next/headers");
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (!host) {
    return undefined;
  }
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return new URL(`${proto}://${host}`);
};
