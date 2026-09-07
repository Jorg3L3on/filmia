export const sameIdList = (left: string[], right: string[]) => {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
};

export const sameOrderedIds = (left: string[], right: string[]) => {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }
  return left.every((id, index) => id === right[index]);
};

export const swapAdjacentIds = (
  ids: string[],
  id: string,
  direction: "up" | "down",
) => {
  const index = ids.indexOf(id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= ids.length) {
    return ids;
  }

  const next = [...ids];
  const current = next[index]!;
  next[index] = next[swapIndex]!;
  next[swapIndex] = current;
  return next;
};
