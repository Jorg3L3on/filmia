"use client";

import Link from "next/link";
import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";
import { JuegosIcon } from "@/components/juegos/JuegosIcon";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { MOODS } from "@/lib/tonight/budget";
import { focusRing } from "@/lib/ui";

type TonightFiltersProps = {
  /** «Ánimo» (FIL-I31-2): one at a time; tapping the chosen one clears it. */
  moodId: string | null;
  onMood: (id: string | null) => void;
  /** Extras' door (FIL-I50-2, entry A): takes the label's place; `fresh` lights the «nuevo» dot. */
  juegos?: { fresh: boolean } | null;
  className?: string;
};

const rowLabelClass = "w-14 shrink-0 text-[11px] font-medium uppercase tracking-[0.18em] text-fog";

/**
 * 44 px tall for the finger, pulled back by 4 px above and below so the row keeps the chips' 36 px
 * and the deck under it does not move.
 */
const juegosButtonClass = cn(
  "press-scale relative -my-1 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent pl-3 pr-3.5 text-sm font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.38),0_12px_24px_-12px_rgba(255,122,69,.85)] transition-colors hover:bg-accent-hover",
  focusRing,
);

/** Extras' door on Hoy: before the moods, never in the dock (FIL-I50-2). */
const JuegosButton = ({ fresh }: { fresh: boolean }) => (
  <Link href={`${JUEGOS_PATH}?desde=boton`} className={juegosButtonClass} data-juegos-entry="boton">
    <JuegosIcon className="size-[1.15rem]" />
    Extras
    {fresh ? (
      <>
        <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-[2.5px] border-canvas bg-star" />
        <span className="sr-only">, hay algo nuevo</span>
      </>
    ) : null}
  </Link>
);

/** «Ánimo» over the deck (FIL-I31-2): one tap narrows Hoy. */
export const TonightFilters = ({ moodId, onMood, juegos = null, className }: TonightFiltersProps) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <div className="flex items-center gap-2">
      {juegos ? (
        <>
          <JuegosButton fresh={juegos.fresh} />
          <span aria-hidden="true" className="h-[22px] w-px shrink-0 bg-line" />
          <span id="tonight-mood-label" className="sr-only">
            Ánimo
          </span>
        </>
      ) : (
        <span id="tonight-mood-label" className={rowLabelClass}>
          Ánimo
        </span>
      )}
      <div
        role="group"
        aria-labelledby="tonight-mood-label"
        className="rail rail-fade tonight-mood-rail flex min-w-0 gap-1.5 overflow-x-auto"
      >
        {MOODS.map((mood) => (
          <button
            key={mood.id}
            type="button"
            aria-pressed={mood.id === moodId}
            onClick={() => onMood(mood.id === moodId ? null : mood.id)}
            className={cn(catalogBarChipClass(mood.id === moodId), "rail-chip")}
          >
            {mood.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);
