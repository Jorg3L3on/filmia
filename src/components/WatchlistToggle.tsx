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
          En la cola
        </span>
        <form action={removeAction}>
          <button type="submit" className={btnGhost}>
            Quitar de Por ver
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={addAction}>
      <button type="submit" className={btnPrimary}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4 fill-current">
          <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l10.2-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14Z" />
        </svg>
        Agregar a Por ver
      </button>
    </form>
  );
};
