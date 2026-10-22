"use client";

import { useLayoutEffect, useRef } from "react";
import { KIND_CHIPS } from "@/lib/catalog-filters";
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
    <div ref={railRef} role="group" aria-label="Buscar por" // The rail scrolls (overflow clips both axes): padding gives the pill's glow room, negative margins keep the layout.
    className="rail rail-fade relative -my-1.5 -ml-1.5 flex gap-2 overflow-x-auto py-1.5 pl-1.5"
    >
      <span
        ref={pillRef}
        aria-hidden="true"
        className={cn(auraPillClass, "buscar-chip-pill pointer-events-none absolute top-1.5 left-0 h-[calc(100%-0.75rem)]")}
      />
      {BUSCAR_CHIPS.map((chip) => {
        const isCurrent = value === chip.value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={isCurrent}
            onClick={() => onChange(chip.value)}
            className={cn(
              // Buscar's chips are 40 px tall (FIL-I22-5): thumbs, not a filter bar; Quiero ver keeps its size.
              "relative z-10 inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium tab-transition press-scale",
              isCurrent
                ? "border-transparent text-paper"
                : "border-white/8 bg-white/[0.04] text-fog hover:bg-white/10 hover:text-paper",
              focusRing,
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
};
