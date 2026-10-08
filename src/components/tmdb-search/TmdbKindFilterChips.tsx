"use client";

import { useLayoutEffect, useRef } from "react";
import { KIND_CHIPS } from "@/lib/catalog-filters";
import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";
import { cn } from "@/lib/cn";
import { auraPillClass, focusRing } from "@/lib/ui";

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

/**
 * One glass pill slides under the current chip (beui Tabs, layoutId indicator) instead of
 * each chip lighting up on its own. The chips keep the Quiero ver size and rail.
 */
export const TmdbKindFilterChips = ({ value, onChange }: TmdbKindFilterChipsProps) => {
  const railRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  // Measure the current chip and move the pill there. Direct style writes, no re-render;
  // the first placement skips the transition so the pill does not fly in from the left.
  useLayoutEffect(() => {
    const rail = railRef.current;
    const pill = pillRef.current;
    if (!rail || !pill) {
      return;
    }
    const place = () => {
      const current = rail.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!current) {
        return;
      }
      pill.style.width = `${current.offsetWidth}px`;
      pill.style.transform = `translateX(${current.offsetLeft}px)`;
      if (!pill.dataset.ready) {
        // Next frame: from now on moves animate.
        requestAnimationFrame(() => {
          pill.dataset.ready = "true";
        });
      }
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={railRef} role="group" aria-label="Buscar por" className="rail rail-fade relative flex gap-2 overflow-x-auto">
      <span
        ref={pillRef}
        aria-hidden="true"
        className={cn(auraPillClass, "buscar-chip-pill pointer-events-none absolute top-0 left-0 h-full")}
      />
      {BUSCAR_CHIPS.map((chip) => {
        const isCurrent = value === chip.value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={isCurrent}
            onClick={() => onChange(chip.value)}
            className={
              isCurrent
                ? cn(
                    "relative z-10 inline-flex shrink-0 items-center rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-paper tab-transition press-scale",
                    focusRing,
                  )
                : // Same chip as Quiero ver; only the lit state moved to the sliding pill.
                  cn(catalogBarChipClass(false), "z-10")
            }
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
};
