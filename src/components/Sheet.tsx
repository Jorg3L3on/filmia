"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useOverlayLayer } from "@/components/useOverlayLayer";
import { cn } from "@/lib/cn";
import { useSheetDragDismiss } from "@/lib/motion";
import {
  sheetAlignClass,
  sheetKeyboardLiftStyle,
  sheetLayerClass,
  sheetOverlayClass,
  sheetPanelClass,
  type SheetAlign,
  type SheetLayer,
} from "@/lib/ui";

/**
 * Shared bottom/center sheet chrome.
 *
 * - Opens with `.sheet-rise` (ease-out, fill-mode backwards so the drag transform is live
 *   afterwards), never `.spring-pop`. Closes with `.sheet-fall` + overlay fade, then unmounts.
 * - Portaled to <body> by default and layered above the mobile tab bar.
 * - Drag-dismiss is on by default; mark scroll/inputs with `[data-no-sheet-drag]`.
 * - While open: scroll lock (ref-counted for stacked sheets), Escape and Tab trap only for the
 *   topmost sheet, focus moves in and returns to the trigger, and `--keyboard-inset` follows the
 *   iOS keyboard via visualViewport so the panel rises above it.
 * - Safe-area padding lives on the panel class.
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

/** Fallback unmount if `animationend` never fires (reduced motion, hidden tab). */
const EXIT_FALLBACK_MS = 320;

let sheetPresence = 0;

/** Lets the toast move above an open sheet (FIL-I27). Ref-counted for stacked sheets. */
const mountSheetPresence = () => {
  sheetPresence += 1;
  document.documentElement.setAttribute("data-sheet-open", "");
  return () => {
    sheetPresence = Math.max(0, sheetPresence - 1);
    if (sheetPresence === 0) {
      document.documentElement.removeAttribute("data-sheet-open");
    }
  };
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
  dragDismiss = true,
  portal = true,
  panelClassName,
  panelStyle,
}: SheetProps) => {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const { sheetStyle, dragHandlers, reset } = useSheetDragDismiss(onClose);
  const panelRef = useRef<HTMLDivElement>(null);

  // Stay mounted through the exit animation, showing the last open content.
  const [rendered, setRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  const [heldChildren, setHeldChildren] = useState(children);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setRendered(true);
      reset();
    }
  }
  if (open && heldChildren !== children) {
    setHeldChildren(children);
  }
  const closing = rendered && !open;

  useOverlayLayer({ open, onClose, panelRef });

  useEffect(() => {
    if (!rendered) {
      return;
    }
    return mountSheetPresence();
  }, [rendered]);

  useEffect(() => {
    if (!closing) {
      return;
    }
    const timer = window.setTimeout(() => setRendered(false), EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (closing && event.target === event.currentTarget && event.animationName === "sheet-fall") {
      setRendered(false);
    }
  };

  if (!rendered) {
    return null;
  }

  if (portal && (!mounted || typeof document === "undefined")) {
    return null;
  }

  const node = (
    <div
      className={cn(sheetAlignClass[align], sheetLayerClass[layer], closing && "pointer-events-none")}
      style={sheetKeyboardLiftStyle}
    >
      <button
        type="button"
        aria-label={overlayLabel}
        tabIndex={-1}
        className={cn(sheetOverlayClass, closing ? "sheet-overlay-out" : "sheet-overlay-in")}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
        className={sheetPanelClass(
          cn(dragDismiss && "sheet-drag-zone", closing && "sheet-fall", "outline-none", panelClassName),
        )}
        style={dragDismiss ? { ...sheetStyle, ...panelStyle } : panelStyle}
        onAnimationEnd={handleAnimationEnd}
        {...(dragDismiss && !closing ? dragHandlers : {})}
      >
        {open ? children : heldChildren}
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
    className={cn("mb-3 h-1 w-10 rounded-full bg-white/20", className)}
  />
);

/**
 * Increments each time `open` turns true. Use it in a form's `key` so the fields reset on every
 * open while the Sheet itself stays mounted long enough to play its exit animation.
 */
export const useOpenGeneration = (open: boolean) => {
  const [generation, setGeneration] = useState(open ? 1 : 0);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setGeneration(generation + 1);
    }
  }
  return generation;
};
