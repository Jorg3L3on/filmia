import type { TitleKind } from "@/db";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { normalizeSearchQuery } from "@/lib/search-session";
import { tmdbCatalogKey } from "@/lib/tmdb-search-catalog";

/** A title the user already has in Filmia and that is not on the list yet. */
export type LocalListTitle = {
  id: string;
  name: string;
  year: number | null;
  posterPath: string | null;
  tmdbId?: number | null;
  kind?: TitleKind | null;
};

/** TMDB hit for the «Agregar título» sheet, already reconciled with the catalog. */
export type TmdbListCandidate = {
  key: string;
  result: TmdbCatalogResult;
  /**
   * `new`: not in Filmia yet — picking it upserts the title and adds it.
   * `local`: already in Filmia, outside this list — add by `titleId`.
   * `in-list`: already on this list (or just added in this session).
   */
  state: "new" | "local" | "in-list";
  titleId: string | null;
};

export type ListAddCandidates = {
  local: LocalListTitle[];
  tmdb: TmdbListCandidate[];
};

type MergeArgs = {
  /** Titles outside the list (`getTitleOptionsOutsideList`). */
  local: readonly LocalListTitle[];
  query: string;
  tmdbResults: readonly TmdbCatalogResult[];
  /** `kind:tmdbId` keys of titles already on the list. */
  inListKeys: ReadonlySet<string>;
  /** Title ids and `kind:tmdbId` keys added during this session. */
  addedKeys: ReadonlySet<string>;
};

const localKey = (title: LocalListTitle) =>
  title.tmdbId != null && title.kind ? tmdbCatalogKey(title.tmdbId, title.kind) : null;

const matchesQuery = (title: LocalListTitle, needle: string) =>
  `${title.name} ${title.year ?? ""}`.toLowerCase().includes(needle);

/**
 * Local matches first (same filter as before: name + year), then TMDB hits with
 * the same criteria as Buscar. A TMDB hit is deduped against the catalog by
 * `kind:tmdbId`: hidden when its local twin is already listed above, turned
 * into a local add when the twin did not match the text filter (e.g. found by
 * original title), and flagged `in-list` when the title is already on the list.
 */
export const mergeListAddCandidates = ({
  local,
  query,
  tmdbResults,
  inListKeys,
  addedKeys,
}: MergeArgs): ListAddCandidates => {
  const needle = normalizeSearchQuery(query).toLowerCase();
  const available = local.filter((title) => !addedKeys.has(title.id));
  const shownLocal = needle
    ? available.filter((title) => matchesQuery(title, needle))
    : available;

  if (!needle) {
    return { local: shownLocal, tmdb: [] };
  }

  const shownKeys = new Set(shownLocal.map(localKey).filter((key) => key !== null));
  const localByKey = new Map<string, LocalListTitle>();
  for (const title of local) {
    const key = localKey(title);
    if (key) {
      localByKey.set(key, title);
    }
  }

  const seen = new Set<string>();
  const tmdb: TmdbListCandidate[] = [];
  for (const result of tmdbResults) {
    const key = tmdbCatalogKey(result.tmdbId, result.kind);
    if (seen.has(key) || shownKeys.has(key)) {
      continue;
    }
    seen.add(key);

    const twin = localByKey.get(key);
    const added = addedKeys.has(key) || (twin ? addedKeys.has(twin.id) : false);
    if (inListKeys.has(key) || added) {
      tmdb.push({ key, result, state: "in-list", titleId: twin?.id ?? null });
    } else if (twin) {
      tmdb.push({ key, result, state: "local", titleId: twin.id });
    } else {
      tmdb.push({ key, result, state: "new", titleId: null });
    }
  }

  return { local: shownLocal, tmdb };
};
