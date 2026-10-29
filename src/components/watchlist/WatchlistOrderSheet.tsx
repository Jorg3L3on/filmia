"use client";

import { useId } from "react";
import { CatalogOrderIcon } from "@/components/catalog-filters/filter-ui";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { CheckIcon, ReorderIcon } from "@/components/watchlist/icons";
import { ArrowIcon } from "@/components/watchlist/WatchlistOrderPill";
import { cn } from "@/lib/cn";
import { focusRing, pillActionClass } from "@/lib/ui";
import { SORT_DIRECTION_LABEL, WATCHLIST_SORT_OPTIONS } from "@/lib/watchlist-filters";
import {
  effectiveDirection,
  SORT_DEFAULT_DIRECTION,
  type SortDirection,
  type WatchlistQuery,
  type WatchlistSort,
} from "@/lib/watchlist-query";

type WatchlistOrderSheetProps = {
  open: boolean;
  query: WatchlistQuery;
  /** 2+ titles: «Reordenar» next to Mi orden (filters pause while reordering). */
  canReorder: boolean;
  onClose: () => void;
  onSelect: (sort: WatchlistSort | null) => void;
  onDirection: (direction: SortDirection) => void;
  onReorder: () => void;
};

/**
 * Ordenar (FIL-I34-3): eight orders with a help line, the direction below for the ones that
 * have one, and Reordenar beside «Mi orden». Picking an order applies it at once.
 */
export const WatchlistOrderSheet = ({
  open,
  query,
  canReorder,
  onClose,
  onSelect,
  onDirection,
  onReorder,
}: WatchlistOrderSheetProps) => {
  const titleId = useId();
  const direction = effectiveDirection(query);
  const words = query.sort ? SORT_DIRECTION_LABEL[query.sort] : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      overlayLabel="Cerrar ordenar"
      layer="top"
      dragDismiss
      portal
      panelClassName="qv-sheet max-h-[min(45rem,92dvh)]"
    >
      <div className="flex flex-col items-center px-5 pt-3">
        <SheetHandle />
        <h2 id={titleId} className="w-full text-left font-serif text-[1.625rem] text-paper">
          Ordenar
        </h2>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3" role="radiogroup" aria-labelledby={titleId} data-no-sheet-drag>
        {WATCHLIST_SORT_OPTIONS.map((option) => {
          const selected = option.id === query.sort;
          return (
            <li key={String(option.id)} className="flex items-center gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSelect(option.id)}
                className={cn(
                  "press-scale flex min-h-12 flex-1 items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors duration-[var(--duration-hover)]",
                  focusRing,
                  selected ? "border-accent/60 bg-accent/15 text-paper" : "border-transparent text-fog hover:bg-white/5 hover:text-paper",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-accent/60 bg-accent/15 text-accent" : "border-white/10 bg-white/5",
                  )}
                >
                  <CatalogOrderIcon name={option.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-medium text-paper">{option.label}</span>
                  <span className="block text-xs text-mist">{option.hint}</span>
                </span>
                {selected ? <CheckIcon size={18} /> : null}
              </button>
              {option.id === null && canReorder ? (
                <button
                  type="button"
                  onClick={onReorder}
                  className={cn(pillActionClass.neutral, "h-11 shrink-0 gap-1.5 px-3 text-sm")}
                >
                  <ReorderIcon size={15} />
                  Reordenar
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="space-y-3 border-t border-line px-5 pb-2 pt-3">
        {direction && words && query.sort && SORT_DEFAULT_DIRECTION[query.sort] ? (
          <div className="qv-direction" role="radiogroup" aria-label="Dirección">
            {(["asc", "desc"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={direction === value}
                onClick={() => onDirection(value)}
                className={cn("qv-direction-cell press-scale", focusRing, direction === value && "is-selected")}
              >
                <ArrowIcon direction={value} size={14} />
                {words[value]}
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" onClick={onClose} className={cn(pillActionClass.primary, "h-[50px] w-full justify-center text-[0.9375rem]")}>
          Listo
        </button>
      </div>
    </Sheet>
  );
};
