"use client";

import { useId, useState } from "react";
import { CHAINS } from "@/components/cine/CinemaBadge";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { premiereWeekdayLabel } from "@/lib/cine-alerts";
import { formatShortDay, ticketStub } from "@/lib/cine-core";
import { cn } from "@/lib/cn";
import { eyebrowClass, focusRing } from "@/lib/ui";

type CinemaChipProps = {
  release: { status: "now" | "upcoming"; mxReleaseDate: string };
  /** The film is in Quiero ver: the «Llega a cines» push will fire, say so. */
  inWatchlist: boolean;
  today: string;
  titleName: string;
};

/**
 * The cinema in the ficha hero (FIL-I23-3), next to «Tráiler»: «● En cines · Horarios ›» opens a
 * sheet with the two chains' carteleras (no city, no showtimes: FIL-I17); before the premiere
 * the chip says «Llega el jue 22 oct» and, with the film in Quiero ver, «te avisamos el jueves».
 */
export const CinemaChip = ({ release, inWatchlist, today, titleName }: CinemaChipProps) => {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  if (release.status === "upcoming") {
    return (
      <>
        <span className="inline-flex h-7 items-center rounded-full border border-cine/70 px-2.5 text-xs font-semibold text-cine">
          Llega el {ticketStub(release.mxReleaseDate).weekday.toLowerCase()} {formatShortDay(release.mxReleaseDate)}
        </span>
        {inWatchlist ? (
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-success/15 px-2.5 text-[11px] font-semibold text-success">
            <BellGlyph />
            te avisamos {premiereWeekdayLabel(release.mxReleaseDate, today)}
          </span>
        ) : null}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "relative inline-flex h-7 items-center gap-1.5 rounded-full bg-cine pl-2.5 pr-2 text-xs font-semibold text-ink shadow-[0_0_14px_rgb(var(--cine-rgb)/0.45)] transition-transform active:scale-[0.97]",
          focusRing,
        )}
      >
        <span className="size-1.5 rounded-full bg-ink" aria-hidden="true" />
        En cines
        <span className="font-normal opacity-70" aria-hidden="true">
          ·
        </span>
        Horarios <span aria-hidden="true">›</span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} labelledBy={titleId} align="bottom" layer="top" portal>
        <SheetHandle />
        <div className="px-5 pb-6 pt-2">
          <p className={eyebrowClass}>En cines desde el {formatShortDay(release.mxReleaseDate)}</p>
          <h3 id={titleId} className="mt-1 font-serif text-xl text-paper">
            ¿Dónde la ves?
          </h3>
          <p className="sr-only">{titleName}</p>
          <ul className="mt-4 divide-y divide-white/8 rounded-2xl border border-white/10 bg-white/[0.03]">
            {CHAINS.map((chain) => (
              <li key={chain.name}>
                <a
                  href={chain.now}
                  target="_blank"
                  rel="noopener"
                  className={cn("flex h-12 items-center justify-between gap-3 px-4 text-[15px] text-paper hover:bg-white/[0.04]", focusRing)}
                >
                  <span className="font-medium">{chain.name}</span>
                  <span className="text-sm text-fog">
                    {chain.name === "Cinemex" ? "abre la app" : "cartelera"} <span aria-hidden="true">↗</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-mist">Sin ciudad ni horarios: cada cadena te lleva a su cartelera.</p>
        </div>
      </Sheet>
    </>
  );
};

const BellGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
