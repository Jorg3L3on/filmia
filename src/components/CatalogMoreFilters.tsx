"use client";

import { useCallback, useEffect, useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { btnGhost, btnPrimary, focusRing } from "@/lib/ui";

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

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose, open]);

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

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Cerrar filtros"
            className="absolute inset-0 bg-black/70"
            onClick={handleClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 flex max-h-[min(42rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-well shadow-[0_-12px_40px_rgba(0,0,0,0.45)] sm:rounded-3xl"
          >
            <div className="flex flex-col items-center px-5 pt-3">
              <span
                aria-hidden="true"
                className="mb-3 h-1 w-10 rounded-full bg-chrome"
              />
              <h2
                id={titleId}
                className="w-full text-left font-serif text-3xl text-paper"
              >
                Filtros
              </h2>
            </div>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {children}
            </div>
            <div className="flex gap-3 border-t border-line px-5 py-4">
              <button
                type="button"
                onClick={onClear}
                className={cn(btnGhost, "flex-1 gap-2")}
              >
                <FunnelIcon />
                Limpiar
              </button>
              <button
                type="button"
                onClick={onApply}
                className={cn(btnPrimary, "flex-1 gap-2")}
              >
                <CheckIcon />
                Aplicar
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
