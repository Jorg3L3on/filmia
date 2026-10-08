/** Buscar «Recientes»: the last searches that led somewhere (a result or a person was opened). */

export const SEARCH_RECENTS_KEY = "filmia.buscar.recientes";
export const SEARCH_RECENTS_MAX = 6;

const foldKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/** Newest first, one entry per query (case and accents ignored), at most SEARCH_RECENTS_MAX. */
export const pushSearchRecent = (recents: readonly string[], query: string): string[] => {
  const trimmed = query.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return [...recents];
  }
  const key = foldKey(trimmed);
  return [trimmed, ...recents.filter((item) => foldKey(item) !== key)].slice(0, SEARCH_RECENTS_MAX);
};

/** Whatever localStorage held, back to a clean list (bad JSON, wrong types → empty). */
export const parseSearchRecents = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) {
      return [];
    }
    const clean: string[] = [];
    for (const item of value) {
      const trimmed = typeof item === "string" ? item.trim().replace(/\s+/g, " ") : "";
      if (trimmed && !clean.some((kept) => foldKey(kept) === foldKey(trimmed))) {
        clean.push(trimmed);
      }
    }
    return clean.slice(0, SEARCH_RECENTS_MAX);
  } catch {
    return [];
  }
};
