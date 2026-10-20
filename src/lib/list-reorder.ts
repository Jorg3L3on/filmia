/**
 * Plans a full manual order (positions 0..n-1) from the ids the client sent.
 * Ids no longer in the list are dropped and items the client didn't send keep
 * their relative order at the end, so a stale optimistic view can't corrupt it.
 * Returns only the position updates that actually change.
 */
export const planListReorder = (
  current: ReadonlyArray<{ id: string; position: number }>,
  orderedIds: readonly string[],
): Array<{ id: string; position: number }> => {
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new Error("Orden inválido: hay películas repetidas.");
  }

  const byPosition = [...current].sort((left, right) => left.position - right.position);
  const currentIds = new Set(byPosition.map((item) => item.id));
  const requested = orderedIds.filter((id) => currentIds.has(id));
  const requestedSet = new Set(requested);
  const finalOrder = [
    ...requested,
    ...byPosition.map((item) => item.id).filter((id) => !requestedSet.has(id)),
  ];

  const positionById = new Map(byPosition.map((item) => [item.id, item.position]));
  return finalOrder.flatMap((id, position) =>
    positionById.get(id) === position ? [] : [{ id, position }],
  );
};
