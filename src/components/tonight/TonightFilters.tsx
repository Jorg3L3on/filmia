"use client";

import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";
import { cn } from "@/lib/cn";
import { MOODS, TIME_BUDGETS } from "@/lib/tonight/budget";

type TonightFiltersProps = {
  budgetId: string;
  onBudget: (id: string) => void;
  /** «Ánimo» (FIL-I31-2): one at a time; tapping the chosen one clears it. */
  moodId: string | null;
  onMood: (id: string | null) => void;
  className?: string;
};

const rowLabelClass = "w-14 shrink-0 text-[11px] font-medium uppercase tracking-[0.18em] text-fog";

/** «Tengo» and «Ánimo» over the deck (FIL-I31): one tap each narrows Hoy to three options. */
export const TonightFilters = ({ budgetId, onBudget, moodId, onMood, className }: TonightFiltersProps) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <div className="flex items-center gap-2">
      <span id="tonight-budget-label" className={rowLabelClass}>
        Tengo
      </span>
      <div role="group" aria-labelledby="tonight-budget-label" className="rail flex min-w-0 gap-1.5 overflow-x-auto">
        {TIME_BUDGETS.map((budget) => (
          <button
            key={budget.id}
            type="button"
            aria-pressed={budget.id === budgetId}
            onClick={() => onBudget(budget.id)}
            className={cn(catalogBarChipClass(budget.id === budgetId), "rail-chip")}
          >
            {budget.label}
          </button>
        ))}
      </div>
    </div>
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
