"use client";

import Image from "next/image";
import { memo, useState, type CSSProperties, type MouseEvent } from "react";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { WatchlistFichaChips } from "@/components/watchlist/WatchlistFichaChips";
import { WatchlistFichaDetail } from "@/components/watchlist/WatchlistFichaDetail";
import { WatchlistHookLine } from "@/components/watchlist/WatchlistHookLine";
import { WatchlistSwipeLayer } from "@/components/watchlist/WatchlistSwipeLayer";
import type { FichaView } from "@/components/watchlist/types";
import { useSwipeActions } from "@/components/watchlist/useSwipeActions";
import { ACCENT_RGB } from "@/lib/aura";
import { cn } from "@/lib/cn";
import { useLongPress } from "@/lib/motion";
import { staggerStyle } from "@/lib/motion-style";
import { tmdbBackdropUrl, tmdbPosterUrl } from "@/lib/tmdb";
import { focusRing, glassRowClass } from "@/lib/ui";

type WatchlistFichaProps = {
  ficha: FichaView;
  rank: number;
  expanded: boolean;
  selected: boolean;
  stamped: boolean;
  /** Entry stagger index (capped at 12 by the caller). */
  stagger: number;
  /** Desktop: a tap selects for the stage instead of unfolding in place. */
  desktop: boolean;
  onToggle: (ficha: FichaView) => void;
  onSelect: (ficha: FichaView) => void;
  onMarkSeen: (ficha: FichaView) => void;
  onTonight: (ficha: FichaView) => void;
  onNotTonight: (ficha: FichaView) => void;
  onMenu: (ficha: FichaView) => void;
};

const WatchlistFichaImpl = ({
  ficha,
  rank,
  expanded,
  selected,
  stamped,
  stagger,
  desktop,
  onToggle,
  onSelect,
  onMarkSeen,
  onTonight,
  onNotTonight,
  onMenu,
}: WatchlistFichaProps) => {
  // Mount the backdrop once the ficha has opened and keep it, so closing fades it out.
  const [hasOpened, setHasOpened] = useState(expanded);
  if (expanded && !hasOpened) {
    setHasOpened(true);
  }

  const swipe = useSwipeActions({
    enabled: !expanded && !stamped,
    onCommit: (side) => (side === "right" ? onMarkSeen(ficha) : onNotTonight(ficha)),
  });
  const longPress = useLongPress(() => {
    swipe.markHandled();
    onMenu(ficha);
  });

  const backdropSrc = hasOpened
    ? (tmdbBackdropUrl(ficha.backdropPath, "w780") ?? tmdbPosterUrl(ficha.posterPath, "w500"))
    : null;

  const swallowAfterGesture = (event: MouseEvent<HTMLElement>) => {
    if (swipe.consumeHandled()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <li
      data-expanded={expanded}
      data-ficha={ficha.id}
      className={cn(
        "ficha-row stagger-in",
        glassRowClass,
        "transition-[border-color,box-shadow] duration-[var(--duration-hover)]",
        expanded &&
          "border-accent/45 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.85),0_0_0_1px_rgb(var(--accent-rgb)/0.15)]",
        desktop && selected && !expanded && "border-accent/40 bg-accent/[0.06]",
        stamped && "is-seen",
        swipe.swiping && "is-swiping",
      )}
      style={
        {
          ...staggerStyle(stagger),
          "--que-ver-glow": ficha.posterAmbient ?? ACCENT_RGB,
        } as CSSProperties
      }
      onPointerEnter={desktop ? () => onSelect(ficha) : undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(ficha);
      }}
    >
      <WatchlistSwipeLayer offset={swipe.offset} armed={swipe.armed} />
      <div
        className="ficha-sheet relative isolate rounded-2xl bg-well"
        style={swipe.offset ? { transform: `translate3d(${swipe.offset}px, 0, 0)` } : undefined}
        {...swipe.handlers}
        {...longPress}
        onClickCapture={swallowAfterGesture}
      >
        {backdropSrc ? (
          <div className="ficha-backdrop" aria-hidden="true">
            <Image
              src={backdropSrc}
              alt=""
              fill
              sizes="(min-width: 1024px) 640px, 100vw"
              className={cn("object-cover object-[center_30%]", !ficha.backdropPath && "scale-125 blur-2xl")}
            />
          </div>
        ) : null}
        {stamped ? (
          <span className="visto-stamp is-row" aria-hidden="true">
            Visto
          </span>
        ) : null}

        <div className="group relative flex items-start gap-3 p-2.5">
          <button
            type="button"
            onClick={() => (desktop ? onSelect(ficha) : onToggle(ficha))}
            aria-expanded={desktop ? undefined : expanded}
            aria-label={`${ficha.name}${desktop ? "" : expanded ? ": cerrar" : ": ver más"}`}
            className={cn("press-scale absolute inset-0 z-10 rounded-2xl", focusRing)}
          />
          <div className="ficha-poster relative shrink-0" data-ficha-poster={ficha.id}>
            <SharedPoster titleId={ficha.id}>
              <PosterImage
                name={ficha.name}
                posterPath={ficha.posterPath}
                sizes="84px"
                className="rounded-poster shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-[filter] duration-[var(--duration-hover)] group-hover:brightness-110"
              />
            </SharedPoster>
            <span className="ficha-rank" aria-hidden="true">
              {rank}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1 pt-0.5">
            <span className="ficha-title line-clamp-2 block font-medium text-paper">
              <span className="sr-only">{rank}. </span>
              {ficha.name}
            </span>
            <span className="block truncate text-xs text-mist">{ficha.meta}</span>
            {ficha.genres.length > 0 ? (
              <span className="block truncate text-xs text-paper/70">{ficha.genres.join(" · ")}</span>
            ) : null}
            <WatchlistFichaChips
              imdbRating={ficha.imdbRating}
              platform={ficha.platform}
              awardLabel={ficha.awardLabel}
            />
            <WatchlistHookLine hook={ficha.hook} />
          </div>
        </div>

        {!desktop ? (
          <div className="ficha-detail" aria-hidden={!expanded}>
            <div>
              {hasOpened ? (
                <div className={cn("px-3 pb-3 pt-0.5", expanded && "ficha-detail-in")} inert={!expanded}>
                  <WatchlistFichaDetail
                    ficha={ficha}
                    onMarkSeen={() => onMarkSeen(ficha)}
                    onTonight={() => onTonight(ficha)}
                    onMenu={() => onMenu(ficha)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
};

export const WatchlistFicha = memo(WatchlistFichaImpl);
