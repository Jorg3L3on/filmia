"use client";

import { useOptimistic, useState, useTransition } from "react";

export const actionErrorMessage = (
  error: unknown,
  fallback = "No se pudo guardar.",
) => (error instanceof Error ? error.message : fallback);

export const useOptimisticValue = <T,>(serverValue: T) => {
  const [value, setValue] = useOptimistic(serverValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (next: T, action: () => Promise<unknown>) => {
    setError(null);
    startTransition(async () => {
      setValue(next);
      try {
        await action();
      } catch (caught) {
        setError(actionErrorMessage(caught));
      }
    });
  };

  return { value, error, isPending, run };
};
