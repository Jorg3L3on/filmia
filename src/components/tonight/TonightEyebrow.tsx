"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { dayPartOf, nightEndsLabel } from "@/lib/tonight/time";
import type { NightEnds } from "@/lib/tonight";
import { focusRing } from "@/lib/ui";

type TonightEyebrowProps = {
  now: Date | null;
  nightEnds: NightEnds;
  /** Phone layout: the chip closes the mood row, moon and time only (the label says the rest). */
  compact?: boolean;
};

/**
 * At night, the bedtime chip «Hasta las 01:00» (edited in Perfil), by the viewer's clock. The
 * «ESTA NOCHE · vie 23 oct» label it used to sit beside is gone; before hydration nothing renders.
 */
export const TonightEyebrow = ({ now, nightEnds, compact = false }: TonightEyebrowProps) => {
  const dayPart = now ? dayPartOf(now, nightEnds) : null;
  const bedtime = now ? nightEndsLabel(now, nightEnds) : null;
  const chip =
    dayPart === "noche" && bedtime ? (
      <Link
        href="/perfil#esta-noche"
        aria-label={`Terminas de ver a las ${bedtime}. Cambiar en Perfil`}
        className={cn(
          "tab-transition inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-black/30 px-2.5 text-[11px] font-semibold tracking-[0.04em] text-paper/85 backdrop-blur hover:border-accent/50 hover:text-paper",
          compact && "tonight-bedtime-inline h-9 px-3",
          focusRing,
        )}
      >
        <MoonIcon />
        {compact ? bedtime : `Hasta las ${bedtime}`}
      </Link>
    ) : null;

  if (!chip) {
    return null;
  }

  if (compact) {
    // Phone: in the flow at the end of the mood row. It used to float fixed at the top right and
    // covered the moods once the phone header was gone (Jorge, FIL-I50).
    return chip;
  }

  return <div className="tonight-eyebrow mx-auto flex w-full max-w-lg items-center justify-end gap-3 px-1">{chip}</div>;
};

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  </svg>
);
