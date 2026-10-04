/**
 * Plans a full manual order (positions 0..n-1) from the ids the client sent.
 * Ids no longer in the list are dropped and items the client didn't send keep
 * their relative order at the end, so a stale optimistic view can't corrupt it.
 * Returns only the position updates that actually change.
 */
export const planListReorder = (
  current: ReadonlyArray<{ titleId: string; position: number }>,
  orderedTitleIds: readonly string[],
): Array<{ titleId: string; position: number }> => {
  if (new Set(orderedTitleIds).size !== orderedTitleIds.length) {
    throw new Error("Orden inválido: hay títulos repetidos.");
  }

  const byPosition = [...current].sort((left, right) => left.position - right.position);
  const currentIds = new Set(byPosition.map((item) => item.titleId));
  const requested = orderedTitleIds.filter((titleId) => currentIds.has(titleId));
  const requestedSet = new Set(requested);
  const finalOrder = [
    ...requested,
    ...byPosition.map((item) => item.titleId).filter((titleId) => !requestedSet.has(titleId)),
  ];

  const positionById = new Map(byPosition.map((item) => [item.titleId, item.position]));
  return finalOrder.flatMap((titleId, position) =>
    positionById.get(titleId) === position ? [] : [{ titleId, position }],
  );
};
