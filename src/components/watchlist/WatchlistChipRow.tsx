"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronIcon, ClockIcon, CloseIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { filterChipLabel, filterChipSpoken, type WatchlistChipNames } from "@/lib/watchlist-chips";
import { activeFilterKeys, type WatchlistFilterKey, type WatchlistQuery } from "@/lib/watchlist-query";

/** Chips wrap; after this many lines the rest fold into «+N más». */
const MAX_LINES = 2;

type WatchlistChipRowProps = {
  query: WatchlistQuery;
  names: WatchlistChipNames;
  /** The order pill leads the row. */
  orderPill: ReactNode;
  disabled?: boolean;
  onToggleShort: () => void;
  onOpenGenres: () => void;
  onRemove: (key: WatchlistFilterKey) => void;
  /** «+N más» opens the Filtros sheet. */
  onMore: () => void;
};

/** Index of the first child that starts a line past `MAX_LINES`, or -1 when everything fits. */
const firstOverflowing = (children: HTMLElement[]) => {
  const tops: number[] = [];
  for (const [index, child] of children.entries()) {
    const top = child.offsetTop;
    if (!tops.includes(top)) tops.push(top);
    if (tops.length > MAX_LINES) return index;
  }
  return -1;
};

/**
 * Order pill, the Cortas and Género shortcuts and every active filter with × (FIL-I34-2).
 * The whole chip removes its filter; at most two lines, then «+N más».
 */
export const WatchlistChipRow = ({
  query,
  names,
  orderPill,
  disabled = false,
  onToggleShort,
  onOpenGenres,
  onRemove,
  onMore,
}: WatchlistChipRowProps) => {
  // Cortas is a shortcut (toggled in place); genres take the Género slot once picked.
  const removable = activeFilterKeys(query).filter((key) => key !== "short");
  const ordered = [...removable.filter((key) => key === "genres"), ...removable.filter((key) => key !== "genres")];
  const rowRef = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const signature = `${ordered.map((key) => filterChipLabel(query, key, names)).join("|")}|${query.sort}|${query.dir}|${query.short}`;
  const [measuredFor, setMeasuredFor] = useState(signature);
  if (measuredFor !== signature) {
    setMeasuredFor(signature);
    setLimit(null);
  }

  // Measure after each render until the chips fit in two lines (each pass folds one more).
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const children = [...row.children] as HTMLElement[];
    const overflow = firstOverflowing(children);
    if (overflow === -1) return;
    const shownCount = limit ?? ordered.length;
    if (shownCount === 0) return;
    const fixedCount = children.length - shownCount - (limit == null ? 0 : 1);
    setLimit(limit == null ? Math.max(0, overflow - fixedCount) : shownCount - 1);
  }, [limit, ordered.length]);

  // A new width can fit more (or fewer): start over.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let width = row.clientWidth;
    const observer = new ResizeObserver(() => {
      if (row.clientWidth === width) return;
      width = row.clientWidth;
      setLimit(null);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  const shown = limit == null ? ordered : ordered.slice(0, limit);
  const hidden = ordered.length - shown.length;
  const genresActive = query.genres.length > 0;

  return (
    <div ref={rowRef} className="qv-chips" role="group" aria-label="Orden y filtros activos">
      {orderPill}
      <button
        type="button"
        aria-pressed={query.short}
        aria-label={`Cortas, menos de 100 minutos${query.short ? ", activado" : ""}`}
        disabled={disabled}
        onClick={onToggleShort}
        className={cn("qv-chip press-scale", focusRing, query.short && "is-on")}
      >
        <ClockIcon size={14} />
        Cortas
      </button>
      {genresActive ? null : (
        <button
          type="button"
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={onOpenGenres}
          className={cn("qv-chip press-scale", focusRing)}
        >
          Género
          <ChevronIcon size={13} />
        </button>
      )}
      {shown.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={filterChipSpoken(query, key, names)}
          disabled={disabled}
          onClick={() => onRemove(key)}
          className={cn("qv-chip is-on press-scale", focusRing)}
        >
          <span className="truncate">{filterChipLabel(query, key, names)}</span>
          <CloseIcon size={14} />
        </button>
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`${hidden} filtros más. Abre los filtros`}
          onClick={onMore}
          className={cn("qv-chip is-more press-scale", focusRing)}
        >
          +{hidden} más
        </button>
      ) : null}
    </div>
  );
};
