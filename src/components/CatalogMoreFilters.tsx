"use client";

import { useCallback, useId, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type CatalogMoreFiltersProps = {
  open: boolean;
  activeCount?: number;
  onOpen: () => void;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  children: ReactNode;
};

export const CatalogMoreFilters = ({
  open,
  activeCount = 0,
  onOpen,
  onClose,
  onClear,
  onApply,
  children,
}: CatalogMoreFiltersProps) => {
  const titleId = useId();

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          activeCount > 0 ? `Filtros, ${activeCount} activos` : "Filtros"
        }
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-full bg-well px-3.5 py-2 text-sm font-medium text-paper",
          focusRing,
          activeCount > 0 && "ring-1 ring-accent/50",
        )}
      >
        <FunnelIcon />
        Filtros
        {activeCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-ink">
            {activeCount}
          </span>
        ) : null}
      </button>

      <Sheet
        open={open}
        onClose={handleClose}
        labelledBy={titleId}
        overlayLabel="Cerrar filtros"
        layer="top"
        panelClassName="max-h-[min(42rem,90vh)]"
      >
        <div className="flex flex-col items-center px-5 pt-3">
          <SheetHandle />
          <h2
            id={titleId}
            className="w-full text-left font-serif text-3xl text-paper"
          >
            Filtros
          </h2>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5" data-no-sheet-drag>
          {children}
        </div>
        <div className="flex gap-3 border-t border-line px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClear} className="flex-1">
            Limpiar
          </Button>
          <Button type="button" onClick={onApply} className="flex-1 gap-2">
            <CheckIcon />
            Aplicar
          </Button>
        </div>
      </Sheet>
    </>
  );
};

const FunnelIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 6h14l-5.2 6.4V17l-3.6 2v-6.6Z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="m6.5 12 3.5 3.5 7.5-7.5" />
  </svg>
);
