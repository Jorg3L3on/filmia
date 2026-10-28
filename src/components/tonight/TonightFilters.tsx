"use client";

import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";
import { cn } from "@/lib/cn";
import { TIME_BUDGETS } from "@/lib/tonight/budget";

type TonightFiltersProps = {
  budgetId: string;
  onBudget: (id: string) => void;
  className?: string;
};

/** «Tengo» over the deck (FIL-I31-1): one tap narrows Hoy to what fits the time. */
export const TonightFilters = ({ budgetId, onBudget, className }: TonightFiltersProps) => (
  <div className={cn("flex items-center gap-2", className)}>
    <span id="tonight-budget-label" className="shrink-0 text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
      Tengo
    </span>
    <div
      role="group"
      aria-labelledby="tonight-budget-label"
      className="rail flex min-w-0 gap-1.5 overflow-x-auto"
    >
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
);
