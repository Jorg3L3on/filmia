"use client";

import Link from "next/link";
import { ChevronIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import { focusRing, glassRowClass, pillActionClass } from "@/lib/ui";

type WatchlistClosingCardProps = {
  total: number;
  /** How many fit before bedtime tonight; null by day (the clock stays quiet). */
  fitCount: number | null;
};

const scrollToTop = () => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
};

/**
 * Closes the list (FIL-I24-7), in small, like Hoy's closing card: the total, how many fit in
 * a night, and the two ways out («Buscar más», «Arriba»).
 */
export const WatchlistClosingCard = ({ total, fitCount }: WatchlistClosingCardProps) => (
  <aside
    data-closing-card
    aria-label="Fin de la lista"
    className={cn(glassRowClass, "flex flex-col items-center gap-3 px-4 py-5 text-center")}
  >
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Eso es todo</p>
    <p className="font-serif text-xl text-paper">
      {total} {total === 1 ? "título" : "títulos"}
      {fitCount !== null ? (
        <span className="text-fog">
          {" · "}
          {fitCount === 1 ? "1 cabe" : `${fitCount} caben`} en una noche
        </span>
      ) : null}
    </p>
    <div className="flex items-center gap-2">
      <Link href="/buscar" className={cn(pillActionClass.primary, "h-10 px-4")}>
        Buscar más
      </Link>
      <button type="button" onClick={scrollToTop} className={cn(pillActionClass.neutral, "h-10 gap-1 px-4", focusRing)}>
        <span className="inline-flex rotate-180">
          <ChevronIcon size={14} />
        </span>
        Arriba
      </button>
    </div>
  </aside>
);
