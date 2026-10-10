"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { recordPickEvents, type PickEventInput } from "@/app/actions/tonight";
import type { PickEventKind } from "@/lib/tonight";
import type { PickRef } from "@/lib/tonight/reco-card";

const SHOWN_AFTER_MS = 1200;
const SKIP_MIN_MS = 180;
const FLUSH_EVERY_MS = 8000;

/**
 * Hero dwell → «shown» (≥1.2 s) or «skipped» (brief glance). Batched and sent
 * after the fact so the sala never waits on the network.
 */
export const useImpressions = (lens: string) => {
  const queue = useRef<PickEventInput[]>([]);
  const current = useRef<{ ref: PickRef; since: number } | null>(null);
  const lensRef = useRef(lens);

  useEffect(() => {
    lensRef.current = lens;
  }, [lens]);

  const flush = useCallback(() => {
    if (queue.current.length === 0) {
      return;
    }
    const batch = queue.current;
    queue.current = [];
    void recordPickEvents(batch).catch(() => {
      // Impressions are advisory; never surface a failure.
    });
  }, []);

  const push = useCallback((ref: PickRef, kind: PickEventKind) => {
    queue.current.push({ ...ref, kind, lens: lensRef.current });
  }, []);

  const settle = useCallback(() => {
    const active = current.current;
    if (!active) {
      return;
    }
    const dwell = performance.now() - active.since;
    if (dwell >= SHOWN_AFTER_MS) {
      push(active.ref, "shown");
    } else if (dwell >= SKIP_MIN_MS) {
      push(active.ref, "skipped");
    }
    current.current = null;
  }, [push]);

  const onHeroChange = useCallback(
    (ref: PickRef | null) => {
      settle();
      if (ref) {
        current.current = { ref, since: performance.now() };
      }
    },
    [settle],
  );

  useEffect(() => {
    const timer = window.setInterval(flush, FLUSH_EVERY_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        settle();
        flush();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      settle();
      flush();
    };
  }, [flush, settle]);

  return useMemo(() => ({ onHeroChange, push, flush }), [flush, onHeroChange, push]);
};
