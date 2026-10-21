"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { DAY_PART_LABEL, dayPartOf, nightEndsLabel } from "@/lib/tonight/time";
import type { NightEnds } from "@/lib/tonight";
import { focusRing } from "@/lib/ui";

type TonightEyebrowProps = {
  now: Date | null;
  nightEnds: NightEnds;
  /** Phone layout: label as the rail's eyebrow, bedtime chip up in the brand row. */
  compact?: boolean;
};

const part = (now: Date, options: Intl.DateTimeFormatOptions) =>
  now.toLocaleDateString("es-MX", options).replace(/\./g, "").trim();

/** «dom 4 oct» — weekday, day and month without the es-MX «de». */
const formatDay = (now: Date) =>
  `${part(now, { weekday: "short" })} ${now.getDate()} ${part(now, { month: "short" })}`;

/**
 * «ESTA TARDE · mar 6 oct» by the viewer's clock; at night the bedtime chip
 * (edited in Perfil) joins it. Before hydration it only says «Hoy».
 */
export const TonightEyebrow = ({ now, nightEnds, compact = false }: TonightEyebrowProps) => {
  const dayPart = now ? dayPartOf(now, nightEnds) : null;
  const bedtime = now ? nightEndsLabel(now, nightEnds) : null;
  const label = (
    <>
      {dayPart ? DAY_PART_LABEL[dayPart] : "Hoy"}
      {now ? <span className="font-medium tracking-[0.12em] text-fog"> · {formatDay(now)}</span> : null}
    </>
  );
  const chip =
    dayPart === "noche" && bedtime ? (
      <Link
        href="/perfil#esta-noche"
        aria-label={`Terminas de ver a las ${bedtime}. Cambiar en Perfil`}
        className={cn(
          "tab-transition inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-black/30 px-2.5 text-[11px] font-semibold tracking-[0.04em] text-paper/85 backdrop-blur hover:border-accent/50 hover:text-paper",
          compact && "tonight-bedtime-fixed",
          focusRing,
        )}
      >
        <MoonIcon />
        Hasta las {bedtime}
      </Link>
    ) : null;

  if (compact) {
    // Phone (FIL-I21-3): the chip joins the brand row (fixed over the header) and the label
    // becomes the rail's eyebrow, so the stage starts two rows down instead of three.
    // The chip is fixed over the header: portaled to <body> so the sala's stacking context
    // (isolation: isolate, under the sticky header) cannot hide it. `now` is only set after
    // hydration, so the chip never renders on the server.
    return (
      <>
        <p className="tonight-eyebrow-compact text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          {label}
        </p>
        {chip && typeof document !== "undefined" ? createPortal(chip, document.body) : chip}
      </>
    );
  }

  return (
    <div className="tonight-eyebrow mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-1">
      <p className="min-w-0 truncate whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
        {label}
      </p>
      {chip}
    </div>
  );
};

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  </svg>
);
