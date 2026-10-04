"use client";

import { useId, useState } from "react";
import { CatalogOrderIcon } from "@/components/catalog-filters/filter-ui";
import { Sheet, SheetHandle } from "@/components/Sheet";
import type { CatalogOrderOption } from "@/lib/catalog-filters";
import { cn } from "@/lib/cn";
import type { CatalogSort } from "@/lib/tags";
import { focusRing } from "@/lib/ui";

type CatalogSortSheetProps = {
  options: ReadonlyArray<CatalogOrderOption>;
  current: CatalogSort | null;
  onSelect: (sort: CatalogSort) => void;
};

export const CatalogSortSheet = ({ options, current, onSelect }: CatalogSortSheetProps) => {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const currentOption = options.find((option) => option.id === current);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleSelect = (sort: CatalogSort) => {
    setOpen(false);
    if (sort === current) return;
    onSelect(sort);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={currentOption ? `Orden: ${currentOption.label}` : "Orden"}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-well px-3 py-1.5 text-xs font-medium text-paper",
          focusRing,
        )}
      >
        <SortIcon />
        {currentOption ? currentOption.label : "Orden"}
      </button>

      <Sheet
        open={open}
        onClose={handleClose}
        labelledBy={titleId}
        overlayLabel="Cerrar orden"
        layer="top"
        dragDismiss
        portal
      >
        <div className="flex flex-col items-center px-5 pt-3">
          <SheetHandle />
          <h2 id={titleId} className="w-full text-left font-serif text-3xl text-paper">
            Orden
          </h2>
        </div>
        <ul className="space-y-1.5 px-3 py-4" role="radiogroup" aria-labelledby={titleId}>
          {options.map((option) => {
            const isSelected = option.id === current;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelect(option.id)}
                  className={cn(
                    "press-scale flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-base transition-colors duration-[var(--duration-hover)]",
                    focusRing,
                    isSelected
                      ? "bg-accent/12 text-paper"
                      : "text-fog hover:bg-chrome/60 hover:text-paper",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-accent/60 bg-accent/15 text-accent"
                        : "border-chrome bg-well",
                    )}
                  >
                    <CatalogOrderIcon name={option.icon} />
                  </span>
                  <span className="flex-1 font-medium">{option.label}</span>
                  {isSelected ? <CheckIcon /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
};

const SortIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3" />
  </svg>
);

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5 text-accent"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m6.5 12 3.5 3.5 7.5-7.5" />
  </svg>
);
