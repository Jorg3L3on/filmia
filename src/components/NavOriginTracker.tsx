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
  type NavEntry,
} from "@/lib/nav-origin";

/* Tab-scoped store over sessionStorage (see src/lib/nav-origin.ts for the rules). */

const EMPTY: NavEntry[] = [];
const SCROLL_SAVE_MS = 150;
const RESTORE_MAX_MS = 2500;

let stack: NavEntry[] | null = null;
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

/** Keeps forcing the saved scroll while streamed content grows; any user input wins. */
const restoreScroll = (y: number) => {
  if (y <= 0) {
    return;
  }
  let stopped = false;
  const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  const stop = () => {
    stopped = true;
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
    window.scrollTo(0, y);
    if (Math.abs(window.scrollY - y) < 2 || performance.now() - started > RESTORE_MAX_MS) {
      stop();
      return;
    }
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
};

/** Record the current location once (tracker and page labels can race; first one wins). */
const visitCurrent = () => {
  const href = currentHref();
  const { stack: next, restored } = recordVisit(load(), href);
  if (next !== stack && JSON.stringify(next) !== JSON.stringify(stack)) {
    commit(next);
  }
  if (restored?.scrollY) {
    restoreScroll(restored.scrollY);
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
      commit(saveCurrentScroll(load(), currentHref(), window.scrollY), false);
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
