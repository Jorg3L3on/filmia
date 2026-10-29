"use client";

import type { ReactNode } from "react";
import { DiceIcon } from "@/components/catalog-filters/filter-ui";
import { WatchlistCountTicker } from "@/components/watchlist/WatchlistCountTicker";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type WatchlistCountProps = {
  shown: number;
  total: number;
  /** «37 de 262» only while something narrows the list. */
  narrowed: boolean;
  /** Error state: «—». */
  unknown?: boolean;
};

/** «37 de 262»: the 37 in paper, the rest quieter (FIL-I34-2). */
export const WatchlistCount = ({ shown, total, narrowed, unknown = false }: WatchlistCountProps) => (
  <span className="qv-count" aria-hidden="true">
    {unknown ? (
      "—"
    ) : narrowed ? (
      <>
        <WatchlistCountTicker count={shown} noun={false} className="text-paper" /> de {total}
      </>
    ) : (
      <WatchlistCountTicker count={total} noun={false} className="text-paper" />
    )}
  </span>
);

/** VoiceOver: «Quiero ver, 37 de 262 títulos». */
export const countSpoken = (shown: number, total: number, narrowed: boolean) =>
  narrowed ? `Quiero ver, ${shown} de ${total} títulos` : `Quiero ver, ${total} ${total === 1 ? "título" : "títulos"}`;

export const FunnelIcon = ({ className = "h-[18px] w-[18px]" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 6h14l-5.2 6.4V17l-3.6 2v-6.6Z" />
  </svg>
);

type RoundButtonProps = {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  badge?: number;
  onClick: () => void;
  children: ReactNode;
  haspopup?: boolean;
};

/** 36 px glass disc, 44 px touch (`.qv-round::before`). */
export const WatchlistRoundButton = ({ label, pressed, disabled, badge = 0, onClick, children, haspopup }: RoundButtonProps) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={pressed}
    aria-haspopup={haspopup ? "dialog" : undefined}
    disabled={disabled}
    onClick={onClick}
    className={cn("qv-round press-scale", focusRing, (pressed || badge > 0) && "is-on")}
  >
    {children}
    {badge > 0 ? (
      <span className="qv-badge" aria-hidden="true">
        {badge}
      </span>
    ) : null}
  </button>
);

type WatchlistTopBarProps = {
  shown: number;
  total: number;
  narrowed: boolean;
  filterCount: number;
  random: boolean;
  disabled?: boolean;
  onSurprise: () => void;
  onFilters: () => void;
};

/** Title + «N de total», Sorpréndeme and the funnel with its badge (FIL-I34-2). */
export const WatchlistTopBar = ({
  shown,
  total,
  narrowed,
  filterCount,
  random,
  disabled = false,
  onSurprise,
  onFilters,
}: WatchlistTopBarProps) => (
  <div className="flex items-center gap-2">
    <h1 className="flex min-w-0 flex-1 items-baseline gap-2 font-serif text-[1.75rem] leading-7 tracking-tight text-paper">
      <span className="truncate">Quiero ver</span>
      <WatchlistCount shown={shown} total={total} narrowed={narrowed} unknown={disabled} />
      <span className="sr-only" role="status" aria-live="polite">
        {disabled ? "" : countSpoken(shown, total, narrowed)}
      </span>
    </h1>
    <WatchlistRoundButton
      label={random ? "Sorpréndeme, activado. Volver a Mi orden" : "Sorpréndeme. Baraja lo que ves"}
      pressed={random}
      disabled={disabled}
      onClick={onSurprise}
    >
      <DiceIcon className="h-[18px] w-[18px]" />
    </WatchlistRoundButton>
    <WatchlistRoundButton
      label={filterCount > 0 ? `Filtros, ${filterCount} ${filterCount === 1 ? "activo" : "activos"}. Abre las opciones` : "Filtros. Abre las opciones"}
      badge={filterCount}
      disabled={disabled}
      haspopup
      onClick={onFilters}
    >
      <FunnelIcon />
    </WatchlistRoundButton>
  </div>
);
