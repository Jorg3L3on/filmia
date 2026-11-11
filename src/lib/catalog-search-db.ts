import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { catalog, db } from "@/db";
import {
  splitCatalogSearch,
  storedAlternateNames,
  type StoredCatalogHit,
} from "@/lib/catalog-search";

/**
 * The Catalog text predicate (FIL-I48-1, shared in FIL-I48-2).
 * `jsonb_array_elements_text` + `ilike` cannot use a btree, and a trigram index
 * would need `pg_trgm`, which this database does not install. Library search is
 * already scoped to one person's titles; the catalog-wide caller limits rows.
 * No extra index.
 */
const namesIlike = (value: string) => {
  const pattern = `%${value}%`;
  return or(
    ilike(catalog.name, pattern),
    ilike(catalog.originalName, pattern),
    sql`exists (
      select 1 from jsonb_array_elements_text(${catalog.alternateNames}) as alt(value)
      where alt.value ilike ${pattern}
    )`,
  )!;
};

/**
 * Name, original title, or a stored alternate. A trailing year ("Ka 1990")
 * also matches that year when the words hit a title, so two short names come
 * apart. The full string still matches a title that literally contains it
 * ("Blade Runner 2049"), even when the year column is the release year.
 */
export const catalogTitlesMatchSql = (query: string) => {
  const { text, year } = splitCatalogSearch(query);
  if (!text) {
    return sql`false`;
  }
  const full = year != null ? `${text} ${year}` : text;
  const fullMatch = namesIlike(full);
  if (year == null) {
    return fullMatch;
  }
  return or(fullMatch, and(namesIlike(text), eq(catalog.year, year)))!;
};

/** How many stored films Buscar adds in front of a TMDB page. */
export const STORED_CATALOG_SEARCH_LIMIT = 8;

export const searchStoredCatalog = async (
  query: string,
  limit = STORED_CATALOG_SEARCH_LIMIT,
): Promise<StoredCatalogHit[]> => {
  const { text } = splitCatalogSearch(query);
  if (text.length < 2) {
    return [];
  }

  const rows = await db
    .select({
      id: catalog.id,
      tmdbId: catalog.tmdbId,
      kind: catalog.kind,
      name: catalog.name,
      originalName: catalog.originalName,
      alternateNames: catalog.alternateNames,
      year: catalog.year,
      posterPath: catalog.posterPath,
      backdropPath: catalog.backdropPath,
      overview: catalog.overview,
    })
    .from(catalog)
    .where(catalogTitlesMatchSql(query))
    .orderBy(
      sql`case
        when lower(${catalog.name}) = lower(${text})
          or lower(coalesce(${catalog.originalName}, '')) = lower(${text})
          or exists (
            select 1 from jsonb_array_elements_text(${catalog.alternateNames}) as alt(value)
            where lower(alt.value) = lower(${text})
          )
        then 0
        else 1
      end`,
      asc(catalog.name),
    )
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    tmdbId: row.tmdbId,
    kind: row.kind,
    name: row.name,
    originalName: row.originalName?.trim() || null,
    alternateNames: storedAlternateNames(row.alternateNames),
    year: row.year,
    posterPath: row.posterPath,
    backdropPath: row.backdropPath,
    overview: row.overview,
  }));
};
