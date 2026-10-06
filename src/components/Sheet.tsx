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

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Open sheets, oldest first. Only the last one reacts to Escape / Tab. */
const sheetStack: symbol[] = [];

let scrollLocks = 0;
let savedOverflow: { html: string; body: string } | null = null;

const lockScroll = () => {
  scrollLocks += 1;
  if (scrollLocks > 1) {
    return;
  }
  const { documentElement: html, body } = document;
  savedOverflow = { html: html.style.overflow, body: body.style.overflow };
  // iOS ignores overflow on <body> alone; locking <html> too stops the page behind from scrolling.
  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
};

const unlockScroll = () => {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks > 0 || !savedOverflow) {
    return;
  }
  document.documentElement.style.overflow = savedOverflow.html;
  document.body.style.overflow = savedOverflow.body;
  savedOverflow = null;
};

const trapTab = (event: KeyboardEvent, panel: HTMLElement) => {
  const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.getClientRects().length > 0,
  );
  if (focusable.length === 0) {
    event.preventDefault();
    panel.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
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
  const onCloseRef = useRef(onClose);

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

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const id = Symbol("sheet");
    sheetStack.push(id);
    lockScroll();

    const root = document.documentElement;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) {
        panel.focus({ preventScroll: true });
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (sheetStack[sheetStack.length - 1] !== id) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === "Tab" && panelRef.current) {
        trapTab(event, panelRef.current);
      }
    };

    const viewport = window.visualViewport;
    const syncKeyboardInset = () => {
      if (!viewport) {
        return;
      }
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
    };
    syncKeyboardInset();
    viewport?.addEventListener("resize", syncKeyboardInset);
    viewport?.addEventListener("scroll", syncKeyboardInset);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      sheetStack.splice(sheetStack.indexOf(id), 1);
      unlockScroll();
      window.removeEventListener("keydown", handleKeyDown);
      viewport?.removeEventListener("resize", syncKeyboardInset);
      viewport?.removeEventListener("scroll", syncKeyboardInset);
      if (sheetStack.length === 0) {
        root.style.removeProperty("--keyboard-inset");
      }
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);

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
