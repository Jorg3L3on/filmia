"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addToWatchlistById, removeFromWatchlistById } from "@/app/actions/watchlist";
import { actionErrorMessage } from "@/lib/use-optimistic-action";
import { btnGhost, btnPrimary } from "@/lib/ui";

type WatchlistToggleProps = {
  titleId: string;
  inWatchlist: boolean;
};

export const WatchlistToggle = ({ titleId, inWatchlist }: WatchlistToggleProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(inWatchlist);

  const handleToggle = () => {
    const next = !optimistic;
    setError(null);
    startTransition(async () => {
      applyOptimistic(next);
      try {
        if (next) {
          await addToWatchlistById(titleId);
        } else {
          await removeFromWatchlistById(titleId);
        }
      } catch (caught) {
        setError(actionErrorMessage(caught));
      }
    });
  };

  return (
    <div className="space-y-2">
      {optimistic ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
            En Quiero ver
          </span>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className={btnGhost}
          >
            {isPending ? "Quitando…" : "Quitar de Quiero ver"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className={btnPrimary}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 4.5h10.5a1 1 0 0 1 1 1V20L12.25 16.5 6 20V5.5a1 1 0 0 1 1-1Z"
            />
          </svg>
          {isPending ? "Guardando…" : "Quiero ver"}
        </button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};
