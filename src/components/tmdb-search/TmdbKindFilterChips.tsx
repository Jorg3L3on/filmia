"use client";

import type { TitleKind } from "@/db";
import { KIND_CHIPS } from "@/lib/catalog-filters";
import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";

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
    className="rail rail-fade flex gap-2 overflow-x-auto"
  >
    {KIND_CHIPS.map((chip) => {
      const isCurrent = kindFilter === chip.value;
      return (
        <button
          key={chip.value}
          type="button"
          aria-pressed={isCurrent}
          onClick={() => onKindFilterChange(chip.value)}
          className={catalogBarChipClass(isCurrent)}
        >
          {chip.label}
        </button>
      );
    })}
  </div>
);
