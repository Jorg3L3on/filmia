/**
 * Tap state of the «Lo mejor del año» grid: none → la vi → mi favorita del año → none.
 * Exactly one favorite at a time; crowning a new one demotes the previous to «la vi».
 */

export type YearPickState = "none" | "seen" | "favorite";

export type YearGridSelection = {
  seen: ReadonlySet<number>;
  favoriteTmdbId: number | null;
};

export type YearPickChange = { tmdbId: number; to: YearPickState };

export const EMPTY_YEAR_SELECTION: YearGridSelection = { seen: new Set(), favoriteTmdbId: null };

export const yearPickStateOf = (selection: YearGridSelection, tmdbId: number): YearPickState => {
  if (selection.favoriteTmdbId === tmdbId) {
    return "favorite";
  }
  return selection.seen.has(tmdbId) ? "seen" : "none";
};

export const cycleYearPick = (
  selection: YearGridSelection,
  tmdbId: number,
): { selection: YearGridSelection; changes: YearPickChange[] } => {
  const state = yearPickStateOf(selection, tmdbId);
  const seen = new Set(selection.seen);

  if (state === "none") {
    seen.add(tmdbId);
    return {
      selection: { seen, favoriteTmdbId: selection.favoriteTmdbId },
      changes: [{ tmdbId, to: "seen" }],
    };
  }

  if (state === "seen") {
    const changes: YearPickChange[] = [];
    if (selection.favoriteTmdbId != null) {
      // The previous crown goes back to «la vi».
      seen.add(selection.favoriteTmdbId);
      changes.push({ tmdbId: selection.favoriteTmdbId, to: "seen" });
    }
    seen.add(tmdbId);
    changes.push({ tmdbId, to: "favorite" });
    return { selection: { seen, favoriteTmdbId: tmdbId }, changes };
  }

  seen.delete(tmdbId);
  return {
    selection: { seen, favoriteTmdbId: null },
    changes: [{ tmdbId, to: "none" }],
  };
};

export const YEAR_PICK_LABEL: Record<YearPickState, string> = {
  none: "sin marcar",
  seen: "la viste",
  favorite: "tu favorita del año",
};

export const YEAR_PICK_NEXT_ACTION: Record<YearPickState, string> = {
  none: "marcarla como vista",
  seen: "hacerla tu favorita del año",
  favorite: "quitar la marca",
};

type LibraryEntry = { tmdbId: number; watched: boolean; rating: number | null };

/** Resume: rebuild the grid state from titles the user already has (favorite = the watched 10 in the grid). */
export const selectionFromLibrary = (
  entries: readonly LibraryEntry[],
  gridTmdbIds: readonly number[],
): YearGridSelection => {
  const inGrid = new Set(gridTmdbIds);
  const seen = new Set<number>();
  let favoriteTmdbId: number | null = null;
  for (const entry of entries) {
    if (!entry.watched || !inGrid.has(entry.tmdbId)) {
      continue;
    }
    seen.add(entry.tmdbId);
    if (entry.rating === 10 && favoriteTmdbId == null) {
      favoriteTmdbId = entry.tmdbId;
    }
  }
  return { seen, favoriteTmdbId };
};
