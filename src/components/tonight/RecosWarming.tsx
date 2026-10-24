"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";

const REFRESH_MS = 4000;
const MAX_REFRESHES = 15;

/** Re-reads Hoy every few seconds while the pool is built (FIL-26); `onGiveUp` after a minute. */
const useWarmingRefresh = (onGiveUp?: () => void) => {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      if (count > MAX_REFRESHES) {
        window.clearInterval(timer);
        onGiveUp?.();
        return;
      }
      router.refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router, onGiveUp]);
};

/** Hoy with nothing to recommend yet: an honest wait instead of an empty deck. */
export const RecosWarming = () => {
  const router = useRouter();
  const [slow, setSlow] = useState(false);
  const giveUp = useCallback(() => setSlow(true), []);
  useWarmingRefresh(slow ? undefined : giveUp);
  return (
    <div aria-live="polite">
      <EmptyState
        title={slow ? "Tarda más de lo normal" : "Buscando recomendaciones…"}
        description={
          slow
            ? "Seguimos armando tus recomendaciones con lo que viste. Vuelve a intentar en un momento."
            : "Con lo que viste armamos tus primeras recomendaciones en tus plataformas. Tarda unos segundos."
        }
        actions={
          slow ? (
            <Button
              size="lg"
              onClick={() => {
                setSlow(false);
                router.refresh();
              }}
            >
              Volver a intentar
            </Button>
          ) : (
            <span className="inline-block size-5 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
          )
        }
      />
    </div>
  );
};

/** The deck already has Quiero ver: recommendations join it when they land, without a word. */
export const RecosRefresher = () => {
  useWarmingRefresh();
  return null;
};
