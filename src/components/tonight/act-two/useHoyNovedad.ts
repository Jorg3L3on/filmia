"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getActTwoStamp } from "@/app/actions/tonight";
import { ACT_TWO_SEEN_EVENT, ACT_TWO_SEEN_KEY } from "@/lib/service-charts";

/** sessionStorage: the last stamp the server gave and when, so the dock asks at most every 30 min. */
const CACHE_KEY = "filmia:hoy-acto-dos-servidor";
const CACHE_MS = 30 * 60 * 1000;

const read = (storage: Storage, key: string) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const readSeen = () => read(window.localStorage, ACT_TWO_SEEN_KEY);

const subscribeSeen = (onChange: () => void) => {
  window.addEventListener(ACT_TWO_SEEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ACT_TWO_SEEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

/** Pure rule, tested: a dot only for someone who has seen act two before and whose stamp moved. */
export const showsNovedad = (seen: string | null, current: string | null) => Boolean(seen && current && seen !== current);

/**
 * The Hoy tab dot (FIL-I47-2): on when the ranking's top three or the newest arrival changed since
 * the user's last look at Hoy's second act. Off on Hoy itself.
 */
export const useHoyNovedad = (onHoy: boolean) => {
  const [current, setCurrent] = useState<string | null>(null);
  const seen = useSyncExternalStore(subscribeSeen, readSeen, () => null);

  useEffect(() => {
    if (onHoy || !readSeen()) {
      return;
    }
    let cancelled = false;
    // After the page settles: the dot is never worth delaying a route.
    const timer = window.setTimeout(() => {
      const cached = read(window.sessionStorage, CACHE_KEY);
      if (cached) {
        const [at, stamp] = cached.split(" ");
        if (Date.now() - Number(at) < CACHE_MS) {
          setCurrent(stamp || null);
          return;
        }
      }
      getActTwoStamp()
        .then((stamp) => {
          if (cancelled) return;
          setCurrent(stamp);
          try {
            window.sessionStorage.setItem(CACHE_KEY, `${Date.now()} ${stamp ?? ""}`);
          } catch {
            // Private mode: ask again next time.
          }
        })
        .catch(() => {});
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [onHoy]);

  return !onHoy && showsNovedad(seen, current);
};
