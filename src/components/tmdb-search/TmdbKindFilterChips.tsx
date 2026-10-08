"use client";

import { KIND_CHIPS } from "@/lib/catalog-filters";
import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";

/** Buscar's chips: the shared kind chips plus «Director» (only here, not in Quiero ver). */
export const BUSCAR_CHIPS = [
  ...KIND_CHIPS,
  { value: "DIRECTOR" as const, label: "Director" },
] as const;

export type BuscarChipValue = (typeof BUSCAR_CHIPS)[number]["value"];

type TmdbKindFilterChipsProps = {
  value: BuscarChipValue;
  onChange: (value: BuscarChipValue) => void;
};

export const TmdbKindFilterChips = ({ value, onChange }: TmdbKindFilterChipsProps) => (
  <div
    role="group"
    aria-label="Buscar por"
    className="rail rail-fade flex gap-2 overflow-x-auto"
  >
    {BUSCAR_CHIPS.map((chip) => {
      const isCurrent = value === chip.value;
      return (
        <button
          key={chip.value}
          type="button"
          aria-pressed={isCurrent}
          onClick={() => onChange(chip.value)}
          className={catalogBarChipClass(isCurrent)}
        >
          {chip.label}
        </button>
      );
    })}
  </div>
);
