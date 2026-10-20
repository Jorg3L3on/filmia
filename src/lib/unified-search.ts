import type { TitleKind } from "@/db/schema";
import { mxToday } from "@/lib/cine-core";
import { getSharedWithMe } from "@/lib/list-invites";
import { loadLists, loadTitles, loadUserTmdbIndex } from "@/lib/queries";
import { isTmdbConfigured, searchTmdbMulti } from "@/lib/tmdb";
import { lookupTmdbCatalogEntry, toTmdbCatalogMap } from "@/lib/tmdb-search-catalog";

/**
 * One free-text search over what a person has and what exists (FIL-I20-4): their library
 * first, then their lists (own and shared), a diary month when the query names one, then
 * TMDB like Buscar does (cached; never OMDb).
 */

export type SearchHit =
  | {
      kind: "title";
      /** A catalog id, or `tmdb:movie:<id>` / `tmdb:tv:<id>` for a film not in their library. */
      ref: string;
      titleId: string | null;
      tmdbId: number;
      titleKind: TitleKind;
      name: string;
      year: number | null;
      inLibrary: boolean;
    }
  | { kind: "list"; id: string; name: string; shared: boolean }
  | { kind: "diary"; month: string };

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «octubre», «octubre 2025», «2025-10» → YYYY-MM (the most recent such month by default). */
export const monthFromQuery = (query: string, now = new Date()) => {
  const text = fold(query);
  const iso = /\b(\d{4})-(0[1-9]|1[0-2])\b/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const index = MONTHS.findIndex((month) => new RegExp(`\\b${month}\\b`).test(text));
  if (index < 0) return null;
  const today = mxToday(now);
  const explicit = /\b(19|20)\d{2}\b/.exec(text)?.[0];
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const year = explicit ? Number(explicit) : index + 1 > currentMonth ? currentYear - 1 : currentYear;
  return `${year}-${String(index + 1).padStart(2, "0")}`;
};

export const searchForUser = async (userId: string, query: string, now = new Date()): Promise<SearchHit[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const needle = fold(trimmed);

  const [library, own, shared, index, tmdb] = await Promise.all([
    loadTitles(userId, { q: trimmed, sort: "recent" }),
    loadLists(userId),
    getSharedWithMe(userId),
    loadUserTmdbIndex(userId),
    isTmdbConfigured() ? searchTmdbMulti(trimmed).catch(() => []) : Promise.resolve([]),
  ]);

  const hits: SearchHit[] = library.slice(0, 10).map((title) => ({
    kind: "title" as const,
    ref: title.catalogId,
    titleId: title.id,
    tmdbId: title.tmdbId,
    titleKind: title.kind,
    name: title.name,
    year: title.year,
    inLibrary: true,
  }));

  for (const list of own) {
    if (fold(list.name).includes(needle)) hits.push({ kind: "list", id: list.id, name: list.name, shared: false });
  }
  for (const list of shared.lists) {
    if (fold(list.name).includes(needle)) hits.push({ kind: "list", id: list.id, name: list.name, shared: true });
  }

  const month = monthFromQuery(trimmed, now);
  if (month) hits.push({ kind: "diary", month });

  const owned = toTmdbCatalogMap(index);
  const seen = new Set(library.map((title) => `${title.kind}:${title.tmdbId}`));
  for (const result of tmdb.slice(0, 10)) {
    const key = `${result.kind}:${result.tmdbId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = lookupTmdbCatalogEntry(owned, result.tmdbId, result.kind);
    hits.push({
      kind: "title",
      ref: `tmdb:${result.kind === "SERIES" ? "tv" : "movie"}:${result.tmdbId}`,
      titleId: entry?.titleId ?? null,
      tmdbId: result.tmdbId,
      titleKind: result.kind,
      name: result.name,
      year: result.year ?? null,
      inLibrary: Boolean(entry),
    });
  }
  return hits;
};
