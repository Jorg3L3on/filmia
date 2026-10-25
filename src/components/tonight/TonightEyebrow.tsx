"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { dayPartOf, nightEndsLabel } from "@/lib/tonight/time";
import type { NightEnds } from "@/lib/tonight";
import { focusRing } from "@/lib/ui";

type TonightEyebrowProps = {
  now: Date | null;
  nightEnds: NightEnds;
  /** Phone layout: the bedtime chip up in the brand row. */
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
          compact && "tonight-bedtime-fixed",
          focusRing,
        )}
      >
        <MoonIcon />
        Hasta las {bedtime}
      </Link>
    ) : null;

  if (!chip) {
    return null;
  }

  if (compact) {
    // Phone (FIL-I21-3): the chip joins the brand row, fixed over the header. Portaled to <body>
    // so the sala's stacking context (isolation: isolate, under the sticky header) cannot hide it.
    return typeof document !== "undefined" ? createPortal(chip, document.body) : chip;
  }

  return <div className="tonight-eyebrow mx-auto flex w-full max-w-lg items-center justify-end gap-3 px-1">{chip}</div>;
};

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  </svg>
);
