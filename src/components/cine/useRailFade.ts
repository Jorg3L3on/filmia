"use client";

import { useEffect, type RefObject } from "react";
import { railFade } from "@/lib/cine-core";

/**
 * Edge fades on a horizontal rail (FIL-I23, P2): `data-fade="left right"` names the edges with
 * more content behind them, and `.cine-fade` masks 24 px there. Updated on scroll and resize,
 * only when the value changes: no per-frame work, no blur.
 */
export const useRailFade = (ref: RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const update = () => {
      const next = railFade(node.scrollLeft, node.clientWidth, node.scrollWidth);
      if (node.dataset.fade !== next) {
        node.dataset.fade = next;
      }
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(node);
    return () => {
      node.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [ref]);
};
