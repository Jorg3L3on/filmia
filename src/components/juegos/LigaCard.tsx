import Link from "next/link";
import { cn } from "@/lib/cn";
import { LIGA_PATH, ordinal } from "@/lib/juegos/liga/core";
import type { LigaSummary } from "@/lib/juegos/liga/store";
import { focusRing } from "@/lib/ui";

/** «Tu lugar» on the portada (FIL-I55-3, board Comp-2-portada): this week's place in the league. */
export const LigaCard = ({ summary }: { summary: LigaSummary }) => (
  <Link
    href={LIGA_PATH}
    className={cn("flex min-h-[3.75rem] items-center gap-3 rounded-[1.2rem] border border-line bg-surface px-3.5 py-2.5 hover:bg-white/[0.03]", focusRing)}
    data-liga="portada"
  >
    <span className={cn("w-12 shrink-0 text-center font-serif text-[1.6rem] font-semibold leading-none tabular-nums", summary ? "text-star" : "text-fog")}>
      {summary ? ordinal(summary.place) : "—"}
    </span>
    <span className="flex min-w-0 flex-1 flex-col">
      <b className="text-[15px] font-semibold text-paper">Liga de la semana</b>
      <span className="truncate text-sm text-fog">
        {!summary
          ? "Juega una diaria o un duelo y entras a la tabla."
          : summary.ahead
            ? `${summary.points} puntos · a ${summary.ahead.gap} de ${summary.ahead.name}`
            : summary.players > 1
              ? `${summary.points} puntos · vas arriba`
              : `${summary.points} puntos`}
      </span>
    </span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5 shrink-0 text-fog">
      <path d="M9 5l7 7-7 7" />
    </svg>
  </Link>
);
