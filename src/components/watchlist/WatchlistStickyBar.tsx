"use client";

import { CheckIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import { pillActionClass } from "@/lib/ui";

type WatchlistStickyBarProps = {
  /** Filters or an order paused while reordering (FIL-I34-3): how many, and the whole list's size. */
  paused: { filters: number; order: boolean } | null;
  total: number;
  onDone: () => void;
  className?: string;
};

const pausedSentence = ({ filters, order }: { filters: number; order: boolean }, total: number) => {
  const what = [
    filters > 0 ? (filters === 1 ? "tu filtro" : `tus ${filters} filtros`) : null,
    order ? "tu orden" : null,
  ].filter(Boolean);
  return `Ves toda tu lista (${total}). Al terminar vuelven ${what.join(" y ")}.`;
};

/**
 * Reordenar mode (FIL-I24-5, FIL-I34-3): «Reordenar · Mi orden» and «Listo», sticky under the
 * header. Filters and orders pause while it is on, and the bar says so.
 */
export const WatchlistStickyBar = ({ paused, total, onDone, className }: WatchlistStickyBarProps) => (
  <div className={cn("qv-edit-bar sticky z-30 -mx-4 space-y-2 px-4 pb-2", className)}>
    <div className="flex h-12 items-center justify-between gap-3">
      <p className="flex min-w-0 items-baseline gap-2">
        <span className="font-serif text-[1.75rem] leading-7 text-paper">Reordenar</span>
        <span className="text-sm font-semibold text-mist">Mi orden</span>
      </p>
      <button type="button" onClick={onDone} aria-pressed className={pillActionClass.primary}>
        <CheckIcon />
        Listo
      </button>
    </div>
    {paused ? (
      <p role="status" className="qv-note is-paused">
        <span>
          <strong className="font-semibold text-paper">{paused.filters > 0 ? "Filtros en pausa." : "Orden en pausa."}</strong>{" "}
          {pausedSentence(paused, total)}
        </span>
      </p>
    ) : (
      <p className="text-[11px] text-mist">Arrastra o usa las flechas</p>
    )}
  </div>
);
