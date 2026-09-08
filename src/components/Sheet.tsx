"use client";

import { useEffect, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useSheetDragDismiss } from "@/lib/motion";
import {
  sheetAlignClass,
  sheetLayerClass,
  sheetOverlayClass,
  sheetPanelClass,
  type SheetAlign,
  type SheetLayer,
} from "@/lib/ui";

/**
 * Shared bottom/center sheet chrome. Fase 0 migrated RatingSheet,
 * CatalogMoreFilters, and DayLogSheet. Deferred to Fase 1: MarkWatchedSheet
 * (portal + optimistic mark-seen), SearchPreviewSheet (hero layout),
 * AddTitleToListCta (catalog picker).
 */

type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  label?: string;
  overlayLabel?: string;
  layer?: SheetLayer;
  align?: SheetAlign;
  dragDismiss?: boolean;
  portal?: boolean;
  panelClassName?: string;
  panelStyle?: CSSProperties;
};

export const Sheet = ({
  open,
  onClose,
  children,
  labelledBy,
  label,
  overlayLabel = "Cerrar",
  layer = "default",
  align = "center",
  dragDismiss = false,
  portal = false,
  panelClassName,
  panelStyle,
}: SheetProps) => {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const { sheetStyle, dragHandlers } = useSheetDragDismiss(onClose);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  if (portal && (!mounted || typeof document === "undefined")) {
    return null;
  }

  const node = (
    <div className={cn(sheetAlignClass[align], sheetLayerClass[layer])}>
      <button
        type="button"
        aria-label={overlayLabel}
        className={sheetOverlayClass}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        className={sheetPanelClass(panelClassName)}
        style={dragDismiss ? { ...sheetStyle, ...panelStyle } : panelStyle}
        {...(dragDismiss ? dragHandlers : {})}
      >
        {children}
      </div>
    </div>
  );

  if (portal) {
    return createPortal(node, document.body);
  }

  return node;
};

export const SheetHandle = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cn("mb-3 h-1 w-10 rounded-full bg-chrome", className)}
  />
);
