"use client";

import type { TitleKind } from "@/db";
import { KIND_CHIPS } from "@/lib/catalog-filters";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type TmdbKindFilterChipsProps = {
  kindFilter: "ALL" | TitleKind;
  onKindFilterChange: (value: "ALL" | TitleKind) => void;
};

export const TmdbKindFilterChips = ({
  kindFilter,
  onKindFilterChange,
}: TmdbKindFilterChipsProps) => (
  <div
    role="group"
    aria-label="Filtro por tipo"
    className="rail flex gap-2 overflow-x-auto"
  >
    {KIND_CHIPS.map((chip) => {
      const isCurrent = kindFilter === chip.value;
      return (
        <button
          key={chip.value}
          type="button"
          aria-pressed={isCurrent}
          onClick={() => onKindFilterChange(chip.value)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium tab-transition",
            focusRing,
            isCurrent ? "bg-accent text-ink" : "bg-well text-paper hover:bg-chrome",
          )}
        >
          {chip.label}
        </button>
      );
    })}
  </div>
);
