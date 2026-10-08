"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import {
  backAction,
  backLabel,
  labelCurrent,
  navOrigin,
  readNavStack,
  recordVisit,
  saveCurrentScroll,
  writeNavStack,
  type NavAnchor,
  type NavEntry,
} from "@/lib/nav-origin";

/* Tab-scoped store over sessionStorage (see src/lib/nav-origin.ts for the rules). */

const EMPTY: NavEntry[] = [];
const SCROLL_SAVE_MS = 150;
const RESTORE_MAX_MS = 6000;
/** Hold the position past the ficha unfold (420 ms) so scroll anchoring cannot drift it. */
const RESTORE_HOLD_MS = 700;

let stack: NavEntry[] | null = null;
/** While a restore runs, clamped scroll events (content still streaming) must not overwrite the target. */
let restoring = false;
const listeners = new Set<() => void>();

const storage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const load = () => {
  stack ??= readNavStack(storage());
  return stack;
};

const commit = (next: NavEntry[], notify = true) => {
  stack = next;
  writeNavStack(next, storage());
  if (notify) {
    for (const listener of listeners) {
      listener();
    }
  }
};

const currentHref = () => `${window.location.pathname}${window.location.search}`;

const ANCHOR_ATTRS = ["data-nav-anchor", "data-ficha"] as const;
const HEADER_CLEARANCE = 64;

/** First row under the sticky header that names itself (Quiero ver rows: `data-ficha`). */
const findAnchor = (): NavAnchor | null => {
  const nodes = document.querySelectorAll<HTMLElement>(ANCHOR_ATTRS.map((attr) => `[${attr}]`).join(","));
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.bottom <= HEADER_CLEARANCE || rect.height === 0) {
      continue;
    }
    const attr = ANCHOR_ATTRS.find((name) => node.hasAttribute(name))!;
    return { selector: `[${attr}="${CSS.escape(node.getAttribute(attr) ?? "")}"]`, offset: rect.top };
  }
  return null;
};

/** Keeps forcing the saved scroll while streamed content grows; any user input wins. */
const restoreScroll = (entry: NavEntry) => {
  const y = entry.scrollY ?? 0;
  const anchor = entry.anchor;
  if (y <= 0 && !anchor) {
    return;
  }
  // The remembered row back at its old distance from the top; the raw scroll when it is gone.
  const target = () => {
    const node = anchor ? document.querySelector(anchor.selector) : null;
    return node ? window.scrollY + node.getBoundingClientRect().top - anchor!.offset : y;
  };
  let stopped = false;
  restoring = true;
  const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  const stop = () => {
    stopped = true;
    restoring = false;
    for (const event of events) {
      window.removeEventListener(event, stop);
    }
  };
  for (const event of events) {
    window.addEventListener(event, stop, { passive: true, once: true });
  }
  const started = performance.now();
  const tick = () => {
    if (stopped) {
      return;
    }
    const goal = Math.max(0, target());
    window.scrollTo(0, goal);
    const elapsed = performance.now() - started;
    if ((Math.abs(window.scrollY - goal) < 2 && elapsed > RESTORE_HOLD_MS) || elapsed > RESTORE_MAX_MS) {
      stop();
      return;
    }
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
};

let reloadChecked = false;
/** True only for the first visit of a page load that was a reload. */
const isReload = () => {
  if (reloadChecked) {
    return false;
  }
  reloadChecked = true;
  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return entry?.type === "reload";
};

/** Record the current location once (tracker and page labels can race; first one wins). */
const visitCurrent = () => {
  const href = currentHref();
  const { stack: next, restored, kind } = recordVisit(load(), href);
  if (JSON.stringify(next) !== JSON.stringify(stack)) {
    commit(next);
  }
  const reloaded = kind === "none" && isReload();
  const current = next.at(-1);
  if (restored) {
    restoreScroll(restored);
  } else if (reloaded && current) {
    // A reload keeps the entry; the browser alone cannot restore a list that streams in later.
    restoreScroll(current);
  } else if (kind === "push") {
    // A new page starts at the top. Next skips its own scroll when the
    // loading skeleton of a short page already sits in the clamped viewport.
    window.scrollTo(0, 0);
  }
  return href;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => load();
const getServerSnapshot = () => EMPTY;

export const NavOriginTracker = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    visitCurrent();
  }, [pathname, query]);

  useEffect(() => {
    let timer: number | null = null;
    const save = () => {
      timer = null;
      if (restoring) {
        return;
      }
      // A sheet locks the page (overflow hidden on <html>) and scrollY reads 0: keep the last real value.
      const locked = document.documentElement.style.overflow === "hidden";
      const top = load().at(-1);
      const scrollY = locked ? (top?.scrollY ?? window.scrollY) : window.scrollY;
      const anchor = locked ? top?.anchor : findAnchor();
      commit(saveCurrentScroll(load(), currentHref(), scrollY, anchor), false);
    };
    const onScroll = () => {
      timer ??= window.setTimeout(save, SCROLL_SAVE_MS);
    };
    // A tap that navigates: save the exact position before Next scrolls the new page to the top.
    const onClickCapture = () => save();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("click", onClickCapture, true);
    window.addEventListener("pagehide", save);
    return () => {
      if (timer != null) {
        window.clearTimeout(timer);
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pagehide", save);
    };
  }, []);

  return null;
};

/** The page names itself for the next page's back button («Hoy · Terror», «Obsesión»). */
export const useNavLabel = (label: string | null | undefined) => {
  useEffect(() => {
    if (!label) {
      return;
    }
    const href = visitCurrent();
    commit(labelCurrent(load(), href, label));
  }, [label]);
};

/** Renders nothing; lets a server page name itself. */
export const NavLabel = ({ label }: { label: string }) => {
  useNavLabel(label);
  return null;
};

/**
 * Origin of the page being shown. Computed as if this visit were already
 * recorded, so the first frame after a navigation (before the tracker's
 * effect) never shows the previous page's origin.
 */
export const useNavOrigin = () => {
  const pathname = usePathname();
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const settled = recordVisit(current, pathname).stack;
  return {
    origin: navOrigin(settled),
    label: backLabel(settled),
    action: () => backAction(recordVisit(load(), currentHref()).stack, window.history.length),
  };
};
