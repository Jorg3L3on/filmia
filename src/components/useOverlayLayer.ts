"use client";

import { useEffect, useRef, type RefObject } from "react";
import { openOverlaySession, type OverlayPanel } from "@/lib/overlay-session";

type UseOverlayLayerOptions<T extends HTMLElement> = {
  open: boolean;
  onClose: () => void;
  panelRef: RefObject<T | null>;
  /** Element focused on open (the dialog's Cancel). Omit to focus the panel. */
  initialFocusRef?: { readonly current: { focus: (options?: { preventScroll?: boolean }) => void } | null };
};

/**
 * While `open`: scroll lock, Escape, Tab trap, focus in, focus back to whatever was
 * focused when the layer opened. Shared by `Sheet` and `ConfirmDialog`.
 */
export const useOverlayLayer = <T extends HTMLElement>({
  open,
  onClose,
  panelRef,
  initialFocusRef,
}: UseOverlayLayerOptions<T>) => {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    return openOverlaySession({
      panel: () => panelRef.current as OverlayPanel | null,
      onClose: () => onCloseRef.current(),
      initialFocus: initialFocusRef ? () => initialFocusRef.current : undefined,
    });
  }, [open, panelRef, initialFocusRef]);
};
