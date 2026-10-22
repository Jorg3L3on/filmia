"use client";

import Link from "next/link";
import { CheckIcon, ReorderIcon } from "@/components/watchlist/icons";
import { WatchlistCountTicker } from "@/components/watchlist/WatchlistCountTicker";
import { cn } from "@/lib/cn";
import { pillActionClass, safeAreaStickyUnderHeaderClass } from "@/lib/ui";

type WatchlistStickyBarProps = {
  count: number;
  /** The page title scrolled away: show it small here. */
  condensed: boolean;
  isEditing: boolean;
  canReorder: boolean;
  /** 2+ titles but a filter or sort is active: which one (FIL-I24-4 says it truthfully). */
  reorderBlocked: "sort" | "filters" | null;
  /** Href that drops the sort («Mi orden»). */
  clearSortHref?: string;
  onToggleEditing: () => void;
  className?: string;
};

/** Count + Reordenar, sticky under the header; the title condenses into it on scroll. */
export const WatchlistStickyBar = ({
  count,
  condensed,
  isEditing,
  canReorder,
  reorderBlocked,
  clearSortHref,
  onToggleEditing,
  className,
}: WatchlistStickyBarProps) => (
  <div
    data-condensed={condensed || isEditing}
    className={cn(
      "sticky z-30 -mx-4 flex items-center justify-between gap-3 px-4 py-2 transition-colors duration-[var(--duration-tab)]",
      safeAreaStickyUnderHeaderClass,
      (condensed || isEditing) && "border-b border-line/70 bg-canvas/90 backdrop-blur-md",
      className,
    )}
  >
    <div className="flex min-w-0 items-baseline">
      <span className="cartelera-condensed-wrap" aria-hidden={!(condensed || isEditing)}>
        <span className="cartelera-condensed-title block whitespace-nowrap pr-2 font-serif text-lg font-semibold text-paper">
          Quiero ver
        </span>
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mist">
        {isEditing ? "Arrastra o usa las flechas" : <WatchlistCountTicker count={count} />}
      </p>
    </div>
    {canReorder ? (
      <button
        type="button"
        onClick={onToggleEditing}
        aria-pressed={isEditing}
        className={isEditing ? pillActionClass.primary : pillActionClass.neutral}
      >
        {isEditing ? <CheckIcon /> : <ReorderIcon />}
        {isEditing ? "Listo" : "Reordenar"}
      </button>
    ) : reorderBlocked === "sort" ? (
      <p className="text-xs text-mist">
        Quita el orden para reordenar
        {clearSortHref ? (
          <>
            {" · "}
            <Link href={clearSortHref} className="text-paper underline-offset-2 hover:underline">
              Mi orden
            </Link>
          </>
        ) : null}
      </p>
    ) : reorderBlocked === "filters" ? (
      <p className="text-xs text-mist">Quita filtros para reordenar</p>
    ) : null}
  </div>
);
