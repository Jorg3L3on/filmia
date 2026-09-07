"use client";

import { useOptimistic, useState, useTransition } from "react";

export const actionErrorMessage = (
  error: unknown,
  fallback = "No se pudo guardar.",
) => (error instanceof Error ? error.message : fallback);

export const sameIdList = (left: string[], right: string[]) => {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
};

/**
 * Optimistic value that stays put after the transition ends (until the
 * server prop actually changes). Plain `useOptimistic` snaps back to the
 * stale RSC props the moment the action resolves, which is the flicker
 * Jorge feels while Neon + revalidatePath catch up.
 */
export const useStickyOptimistic = <T,>(
  serverValue: T,
  isSame: (left: T, right: T) => boolean = Object.is,
) => {
  const [serverSeen, setServerSeen] = useState(serverValue);
  const [confirmed, setConfirmed] = useState(serverValue);

  if (!isSame(serverValue, serverSeen)) {
    setServerSeen(serverValue);
    setConfirmed(serverValue);
  }

  const [value, applyOptimistic] = useOptimistic(
    confirmed,
    (_current: T, next: T) => next,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (next: T, action: () => Promise<unknown>) => {
    setError(null);
    startTransition(async () => {
      applyOptimistic(next);
      try {
        await action();
        setConfirmed(next);
      } catch (caught) {
        setError(actionErrorMessage(caught));
      }
    });
  };

  return { value, error, isPending, run, setError };
};
