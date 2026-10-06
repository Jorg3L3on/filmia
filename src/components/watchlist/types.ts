import type { TonightFit } from "@/lib/tonight/types";
import type { WatchlistFicha } from "@/lib/watchlist-ficha";
import type { WatchlistHook } from "@/lib/watchlist-hook";

/** A ficha once the client has applied the clock: the hook to show and tonight's fit. */
export type FichaView = WatchlistFicha & {
  hook: WatchlistHook | null;
  fit: TonightFit | null;
  pinned: boolean;
};
