import { ImdbBadge } from "@/components/ImdbBadge";
import { PlatformLogo } from "@/components/PlatformLogo";
import { LaurelIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import type { WatchlistFichaPlatform } from "@/lib/watchlist-ficha";

type WatchlistFichaChipsProps = {
  imdbRating: number | null;
  platform: WatchlistFichaPlatform | null;
  awardLabel: string | null;
  className?: string;
};

/** IMDb · platform (+N) · gold award chip. Spans only: it also lives inside the row's button. */
export const WatchlistFichaChips = ({
  imdbRating,
  platform,
  awardLabel,
  className,
}: WatchlistFichaChipsProps) => {
  if (imdbRating == null && !platform && !awardLabel) {
    return null;
  }

  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <ImdbBadge rating={imdbRating} compact />
      {platform ? (
        <span className="inline-flex h-5 items-center gap-1 rounded-full border border-white/15 bg-black/35 pl-0.5 pr-2 text-[11px] font-medium text-paper">
          {platform.platform ? (
            <PlatformLogo platform={platform.platform} size={16} className="rounded-full" />
          ) : null}
          {platform.label}
          {platform.extraCount > 0 ? (
            <span className="text-paper/60">+{platform.extraCount}</span>
          ) : null}
        </span>
      ) : null}
      {awardLabel ? (
        <span className="inline-flex h-5 max-w-full items-center gap-1 truncate rounded-full border border-star/35 bg-star/10 px-2 text-[11px] font-medium text-star">
          <LaurelIcon />
          <span className="truncate">{awardLabel}</span>
        </span>
      ) : null}
    </span>
  );
};
