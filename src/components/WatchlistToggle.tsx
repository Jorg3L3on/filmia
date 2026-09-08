"use client";

import { addToWatchlistById, removeFromWatchlistById } from "@/app/actions/watchlist";
import { Button } from "@/components/Button";
import { showToast } from "@/lib/toast";
import { useStickyOptimistic } from "@/lib/use-optimistic-action";

type WatchlistToggleProps = {
  titleId: string;
  inWatchlist: boolean;
};

export const WatchlistToggle = ({ titleId, inWatchlist }: WatchlistToggleProps) => {
  const { value: optimistic, error, isPending, run } = useStickyOptimistic(inWatchlist);

  const handleToggle = () => {
    const next = !optimistic;
    showToast({
      title: next ? "En Quiero ver" : "Fuera de Quiero ver",
    });
    run(next, async () => {
      if (next) {
        await addToWatchlistById(titleId);
      } else {
        await removeFromWatchlistById(titleId);
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
          <Button
            type="button"
            variant="ghost"
            onClick={handleToggle}
            pending={isPending}
            pendingLabel="Quitando…"
          >
            Quitar de Quiero ver
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={handleToggle} pending={isPending} pendingLabel="Guardando…">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 4.5h10.5a1 1 0 0 1 1 1V20L12.25 16.5 6 20V5.5a1 1 0 0 1 1-1Z"
            />
          </svg>
          Quiero ver
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};
