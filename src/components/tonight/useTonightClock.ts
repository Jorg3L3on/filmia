"use client";

import { useEffect, useState } from "react";
import type { NightEnds } from "@/lib/tonight";
import { nextDayPartChange } from "@/lib/tonight/time";
import { useMountedNow } from "@/lib/use-mounted-now";

/**
 * The sala clock: the viewer's time after hydration, bumped once more each
 * time the part of the day changes (06:00, 12:00, 19:00 or bedtime − 4 h) so a
 * page left open crosses into «Esta noche» on its own.
 */
export const useTonightClock = (nightEnds: NightEnds) => {
  const mountedNow = useMountedNow();
  const [bumpedNow, setBumpedNow] = useState<Date | null>(null);
  const now = bumpedNow ?? mountedNow;

  useEffect(() => {
    if (!now) {
      return;
    }
    const next = nextDayPartChange(now, nightEnds);
    const delay = Math.max(1_000, next.getTime() - Date.now() + 1_000);
    const timer = window.setTimeout(() => setBumpedNow(new Date()), delay);
    return () => window.clearTimeout(timer);
  }, [now, nightEnds]);

  return now;
};
