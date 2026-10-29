"use client";

import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";
import { cn } from "@/lib/cn";
import { MOODS } from "@/lib/tonight/budget";

type TonightFiltersProps = {
  /** «Ánimo» (FIL-I31-2): one at a time; tapping the chosen one clears it. */
  moodId: string | null;
  onMood: (id: string | null) => void;
  className?: string;
};

const rowLabelClass = "w-14 shrink-0 text-[11px] font-medium uppercase tracking-[0.18em] text-fog";

/** «Ánimo» over the deck (FIL-I31-2): one tap narrows Hoy. */
export const TonightFilters = ({ moodId, onMood, className }: TonightFiltersProps) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <div className="flex items-center gap-2">
      <span id="tonight-mood-label" className={rowLabelClass}>
        Ánimo
      </span>
      <div
        role="group"
        aria-labelledby="tonight-mood-label"
        className="rail rail-fade flex min-w-0 gap-1.5 overflow-x-auto"
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
