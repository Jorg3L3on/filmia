/** Extra titles beyond the first — badge `+N` on multi-title calendar days. */
export const extraDayBadge = (count: number) =>
  count > 1 ? `+${count - 1}` : null;

export const dayCellOpensSheet = (count: number) => count > 1;
