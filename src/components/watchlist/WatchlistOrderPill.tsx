"use client";

import { ChevronIcon, ReorderIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { directionSpoken, sortPillLabel } from "@/lib/watchlist-filters";
import { effectiveDirection, type WatchlistQuery } from "@/lib/watchlist-query";

export const ArrowIcon = ({ direction, size = 16 }: { direction: "asc" | "desc"; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={direction === "desc" ? "rotate-180" : undefined}
  >
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

type WatchlistOrderPillProps = {
  query: Pick<WatchlistQuery, "sort" | "dir">;
  disabled?: boolean;
  /** Condensed bar: icon only. */
  compact?: boolean;
  onOpen: () => void;
  onFlip: () => void;
};

/**
 * Orden (FIL-I34-3): one pill that opens the Ordenar sheet and, for orders with a direction,
 * a 34×44 arrow segment that flips it (the one exception to 44×44).
 */
export const WatchlistOrderPill = ({ query, disabled = false, compact = false, onOpen, onFlip }: WatchlistOrderPillProps) => {
  const label = sortPillLabel(query);
  const direction = effectiveDirection(query);
  const active = query.sort != null;
  return (
    <div className={cn("qv-order", active && "is-on", compact && "is-compact")}>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-label={`Orden: ${label}. Cambiar`}
        className={cn("qv-order-main press-scale", focusRing)}
      >
        <ReorderIcon size={15} />
        {compact ? null : (
          <>
            <span className="truncate">{label}</span>
            <ChevronIcon size={13} />
          </>
        )}
      </button>
      {direction ? (
        <button
          type="button"
          onClick={onFlip}
          disabled={disabled}
          aria-label={`Dirección: ${directionSpoken(direction)}. Invertir`}
          className={cn("qv-order-dir press-scale", focusRing)}
        >
          <ArrowIcon direction={direction} />
        </button>
      ) : null}
    </div>
  );
};
