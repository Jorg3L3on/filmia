import type { PickEventKind, TonightEvent } from "@/lib/tonight/types";

export const PICK_EVENT_KINDS: readonly PickEventKind[] = [
  "shown",
  "skipped",
  "not_tonight",
  "opened",
  "watched",
  "more_like",
  "less_like",
  "pinned",
];

export const isPickEventKind = (value: unknown): value is PickEventKind =>
  typeof value === "string" && (PICK_EVENT_KINDS as readonly string[]).includes(value);

/** A `PickEvent` row as stored: a film (`catalogId`) and, when the user owns it, their `Title`. */
export type StoredPickEvent = {
  titleId: string | null;
  catalogId: string | null;
  kind: string;
  createdAt: Date;
};

/**
 * The id the engine keys an event by: the user's own `Title` when they have the film (so
 * feedback given while it was a recommendation still counts after they add it), else the
 * film itself. Rows written before 0011 only carry a `titleId`.
 */
export const eventItemId = (
  row: Pick<StoredPickEvent, "titleId" | "catalogId">,
  titleIdByCatalog: ReadonlyMap<string, string>,
): string | null =>
  (row.catalogId ? titleIdByCatalog.get(row.catalogId) : undefined) ??
  row.titleId ??
  row.catalogId;

export const toTonightEvents = (
  rows: readonly StoredPickEvent[],
  titleIdByCatalog: ReadonlyMap<string, string>,
): TonightEvent[] =>
  rows.flatMap((row) => {
    const titleId = eventItemId(row, titleIdByCatalog);
    return titleId && isPickEventKind(row.kind)
      ? [{ titleId, kind: row.kind, createdAt: row.createdAt }]
      : [];
  });
