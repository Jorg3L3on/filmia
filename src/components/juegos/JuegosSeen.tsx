"use client";

import { useEffect, useRef } from "react";
import { markJuegosOpened } from "@/app/actions/juegos";

/**
 * Records the visit to the portada once per mount (FIL-I50-2): Hoy's «nuevo» dot goes off.
 * A client effect, so a prefetch of `/juegos` never counts as a visit.
 */
export const JuegosSeen = ({ entry }: { entry: string | null }) => {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) {
      return;
    }
    sent.current = true;
    void markJuegosOpened(entry).catch(() => {
      // The dot stays one more visit; nothing else depends on it.
    });
  }, [entry]);
  return null;
};
