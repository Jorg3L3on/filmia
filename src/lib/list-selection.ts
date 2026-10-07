export type SelectableList = { id: string; name: string; slug: string | null };

export type ListSelectionDiff = {
  add: string[];
  remove: string[];
  changed: boolean;
};

/** Order-insensitive diff between the lists a title is in and the picked ones. */
export const diffListSelection = (
  initial: readonly string[],
  selected: readonly string[],
): ListSelectionDiff => {
  const before = new Set(initial);
  const after = new Set(selected);
  const add = [...after].filter((id) => !before.has(id));
  const remove = [...before].filter((id) => !after.has(id));
  return { add, remove, changed: add.length > 0 || remove.length > 0 };
};

export const toggleListSelection = (selected: readonly string[], listId: string) =>
  selected.includes(listId)
    ? selected.filter((id) => id !== listId)
    : [...selected, listId];

/**
 * Starting selection for the picker: known collection memberships plus Quiero
 * ver from the search catalog (its own toggle can change it in the same sheet).
 * Ids of lists the user no longer has are dropped.
 */
export const initialListSelection = ({
  lists,
  memberListIds,
  inWatchlist,
  watchlistSlug = "watchlist",
}: {
  lists: readonly SelectableList[];
  memberListIds: readonly string[];
  inWatchlist: boolean;
  watchlistSlug?: string;
}) => {
  const watchlistId = lists.find((list) => list.slug === watchlistSlug)?.id ?? null;
  const known = new Set(lists.map((list) => list.id));
  const ids = memberListIds.filter((id) => known.has(id) && id !== watchlistId);
  if (inWatchlist && watchlistId) {
    ids.unshift(watchlistId);
  }
  return [...new Set(ids)];
};

/** Label for the confirm button of the picker. */
export const listSelectionConfirmLabel = (
  diff: ListSelectionDiff,
  selectedCount: number,
) => {
  if (!diff.changed) {
    return "Sin cambios";
  }
  if (selectedCount === 0) {
    return "Quitar de las listas";
  }
  return selectedCount === 1 ? "Guardar en 1 lista" : `Guardar en ${selectedCount} listas`;
};

/** Toast after confirming: names the list when only one was added. */
export const listSelectionToast = (
  lists: readonly SelectableList[],
  diff: ListSelectionDiff,
  titleName: string,
) => {
  const nameOf = (id: string) => lists.find((list) => list.id === id)?.name ?? "la lista";

  if (diff.add.length === 1 && diff.remove.length === 0) {
    return { title: `En ${nameOf(diff.add[0])}`, description: titleName };
  }
  if (diff.add.length > 1 && diff.remove.length === 0) {
    return { title: `En ${diff.add.length} listas`, description: titleName };
  }
  if (diff.add.length === 0 && diff.remove.length === 1) {
    return { title: `Fuera de ${nameOf(diff.remove[0])}`, description: titleName };
  }
  return { title: "Listas actualizadas", description: titleName };
};
