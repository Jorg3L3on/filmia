import { EyeIcon, MoonIcon } from "@/components/watchlist/icons";
import type { SwipeSide } from "@/components/watchlist/useSwipeActions";
import { cn } from "@/lib/cn";

type WatchlistSwipeLayerProps = {
  offset: number;
  armed: SwipeSide | null;
};

/** What shows under a ficha while it slides: «Vi esto» on the right, «Ahora no» on the left. */
export const WatchlistSwipeLayer = ({ offset, armed }: WatchlistSwipeLayerProps) => (
  <>
    <div
      aria-hidden="true"
      className={cn("ficha-swipe-under is-right", armed === "right" && "is-armed", offset <= 0 && "invisible")}
    >
      <span className="ficha-swipe-label inline-flex items-center gap-2">
        <EyeIcon size={20} />
        {armed === "right" ? "Suelta para «Vi esto»" : "Vi esto"}
      </span>
    </div>
    <div
      aria-hidden="true"
      className={cn("ficha-swipe-under is-left", armed === "left" && "is-armed", offset >= 0 && "invisible")}
    >
      <span className="ficha-swipe-label inline-flex items-center gap-2">
        {armed === "left" ? "Suelta: ahora no" : "Ahora no · 2 semanas"}
        <MoonIcon size={18} />
      </span>
    </div>
  </>
);
