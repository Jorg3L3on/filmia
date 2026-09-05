import { addToWatchlistById, removeFromWatchlistById } from "@/app/actions/watchlist";
import { btnGhost, btnPrimary } from "@/lib/ui";

type WatchlistToggleProps = {
  titleId: string;
  inWatchlist: boolean;
};

export const WatchlistToggle = ({ titleId, inWatchlist }: WatchlistToggleProps) => {
  const addAction = addToWatchlistById.bind(null, titleId);
  const removeAction = removeFromWatchlistById.bind(null, titleId);

  if (inWatchlist) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
          En Quiero ver
        </span>
        <form action={removeAction}>
          <button type="submit" className={btnGhost}>
            Quitar de Quiero ver
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={addAction}>
      <button type="submit" className={btnPrimary}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 4.5h10.5a1 1 0 0 1 1 1V20L12.25 16.5 6 20V5.5a1 1 0 0 1 1-1Z"
          />
        </svg>
        Quiero ver
      </button>
    </form>
  );
};
