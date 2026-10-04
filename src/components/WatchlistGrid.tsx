"use client";

import Link from "next/link";
import { WatchlistPoster } from "@/components/WatchlistCard";
import type { WatchlistItem } from "@/components/watchlist-types";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import { staggerStyle } from "@/lib/motion-style";
import { focusRing } from "@/lib/ui";

type WatchlistGridProps = {
  items: WatchlistItem[];
  /** Rank shown on the first tile; the hero holds #1. */
  firstRank?: number;
  preferredPlatforms?: readonly Platform[];
  onMarkedSeen: (titleId: string) => void;
  onMarkSeenError: (titleId: string) => void;
};

export const WatchlistGrid = ({
  items,
  firstRank = 2,
  preferredPlatforms = [],
  onMarkedSeen,
  onMarkSeenError,
}: WatchlistGridProps) => (
  <section aria-labelledby="watchlist-queue-heading" className="space-y-4">
    <h2
      id="watchlist-queue-heading"
      className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mist"
    >
      Después
    </h2>
    <ol className="grid grid-cols-3 gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-x-5 lg:grid-cols-5">
      {items.map((item, index) => {
        const rank = firstRank + index;
        const { title } = item;
        return (
          <li
            key={item.titleId}
            className="stagger-in min-w-0"
            style={staggerStyle(Math.min(index, 12))}
          >
            <div className="relative pl-3">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-2 -left-0.5 z-20 font-serif text-[3.25rem] font-bold leading-none text-canvas [-webkit-text-stroke:1.5px_rgb(255_255_255/0.7)] [text-shadow:0_6px_18px_rgb(0_0_0/0.6)] sm:text-6xl"
              >
                {rank}
              </span>
              <WatchlistPoster
                title={title}
                size="hero"
                className="isolate z-0 w-full"
                posterClassName="rounded-poster shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-[filter] duration-[var(--duration-hover)] group-hover:brightness-110"
                sizes="(min-width: 1024px) 200px, (min-width: 640px) 25vw, 33vw"
                preferredPlatforms={preferredPlatforms}
                onMarkedSeen={() => onMarkedSeen(item.titleId)}
                onMarkSeenError={() => onMarkSeenError(item.titleId)}
              />
            </div>
            <div className="mt-3 min-w-0 pl-3">
              <h3 className="line-clamp-2 text-sm font-medium leading-snug text-paper">
                <Link
                  href={`/titulos/${title.id}`}
                  className={cn("hover:text-accent", focusRing)}
                >
                  <span className="sr-only">{rank}. </span>
                  {title.name}
                </Link>
              </h3>
              <p className="mt-0.5 truncate text-xs text-mist">
                {title.year ? `${title.year} · ` : ""}
                {TITLE_KIND_LABEL[title.kind]}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  </section>
);
