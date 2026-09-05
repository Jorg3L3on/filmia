"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { btnGhost, focusRing } from "@/lib/ui";

type CatalogMoreFiltersProps = {
  activeCount?: number;
  children: ReactNode;
};

export const CatalogMoreFilters = ({
  activeCount = 0,
  children,
}: CatalogMoreFiltersProps) => {
  const titleId = useId();
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

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
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
          focusRing,
          activeCount > 0
            ? "border-accent bg-accent/15 text-accent"
            : "border-chrome text-fog hover:border-[#555] hover:text-white",
        )}
      >
        Más filtros
        {activeCount > 0 ? (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-ink">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
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
            className="relative z-10 flex max-h-[min(40rem,88vh)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-[0_-12px_40px_rgba(0,0,0,0.45)] sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <h2 id={titleId} className="font-serif text-2xl text-paper">
                Más filtros
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className={cn(btnGhost, "px-3 py-1 text-xs")}
              >
                Cerrar
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {children}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
