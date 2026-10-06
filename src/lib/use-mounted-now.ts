"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

/**
 * The viewer's clock, fixed once after hydration. The snapshot must be stable
 * (a fresh Date.now() per read would re-render forever), so the stamp lives in
 * a tiny per-mount store that notifies exactly once on subscribe.
 */
const createMountedNowStore = () => {
  let stamp = 0;
  return {
    subscribe(listener: () => void) {
      if (stamp === 0) {
        stamp = Date.now();
        listener();
      }
      return () => {};
    },
    getSnapshot: () => stamp,
    getServerSnapshot: () => 0,
  };
};

/** `null` on the server and during hydration; the local Date afterwards (Hoy, Quiero ver). */
export const useMountedNow = () => {
  const [store] = useState(createMountedNowStore);
  const stamp = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return useMemo(() => (stamp === 0 ? null : new Date(stamp)), [stamp]);
};
