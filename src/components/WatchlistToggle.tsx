import { addToWatchlistById, removeFromWatchlistById } from "@/app/actions/watchlist";

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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#2563eb]/20 via-[#7c3aed]/20 to-[#db2777]/20 px-3 py-1 text-xs font-medium text-[#c4b5fd]">
          En la cola
        </span>
        <form action={removeAction}>
          <button
            type="submit"
            className="rounded-full border border-[#3a3a3a] px-4 py-2 text-sm text-[#99aabb] hover:border-[#555] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b5cf6]"
          >
            Quitar de Por ver
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={addAction}>
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#2563eb] via-[#7c3aed] to-[#db2777] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l10.2-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14Z" />
        </svg>
        Agregar a Por ver
      </button>
    </form>
  );
};
