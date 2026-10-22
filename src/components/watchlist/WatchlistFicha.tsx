"use client";

import Image from "next/image";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import { composeHandlers } from "@/lib/compose-handlers";
import { useLongPress } from "@/lib/motion";
import { claimOncePerDay } from "@/lib/once-per-day";
import { UNFOLD_DOCK_GAP_PX, UNFOLD_HEADER_GAP_PX, unfoldScrollDelta } from "@/lib/reveal-unfolded";
import { staggerStyle } from "@/lib/motion-style";
import { isRemoteImage, tmdbBackdropUrl, tmdbPosterUrl } from "@/lib/tmdb";
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
  /** Eligible for the daily hint (FIL-I24-1): the row slides 24 px right and back to show «Vi esto». */
  hint?: boolean;
  onToggle: (ficha: FichaView) => void;
  onSelect: (ficha: FichaView) => void;
  onMarkSeen: (ficha: FichaView) => void;
  onTonight: (ficha: FichaView) => void;
  onNotTonight: (ficha: FichaView) => void;
  onMenu: (ficha: FichaView) => void;
};

const HINT_DELAY_MS = 1200;

/**
 * Scroll the page so a row that just unfolded ends above the dock (FIL-I24-2). The unfold is a
 * 420 ms transition, so the final height is measured first with transitions off (the row is
 * rewound to its folded values and released again, like FLIP), and the page scrolls alongside.
 */
const revealUnfoldedRow = (row: HTMLLIElement) => {
  const detail = row.querySelector<HTMLElement>(".ficha-detail");
  const poster = row.querySelector<HTMLElement>(".ficha-poster");
  const title = row.querySelector<HTMLElement>(".ficha-title");

  row.classList.add("ficha-measuring");
  const { top: rowTop, bottom: rowBottom } = row.getBoundingClientRect();
  // Rewind to the folded values so the unfold still animates once transitions are back.
  if (detail) detail.style.gridTemplateRows = "0fr";
  if (poster) poster.style.width = "64px";
  if (title) {
    title.style.fontSize = "15px";
    title.style.lineHeight = "1.25";
  }
  void row.offsetHeight;
  row.classList.remove("ficha-measuring");
  if (detail) detail.style.gridTemplateRows = "";
  if (poster) poster.style.width = "";
  if (title) {
    title.style.fontSize = "";
    title.style.lineHeight = "";
  }

  const dock = document.querySelector<HTMLElement>('nav[aria-label="Principal móvil"] > div');
  const header = document.querySelector<HTMLElement>("header.site-header");
  const dockTop = dock && dock.offsetParent !== null ? dock.getBoundingClientRect().top : window.innerHeight;
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const delta = unfoldScrollDelta({
    rowTop,
    rowBottom,
    limitBottom: dockTop - UNFOLD_DOCK_GAP_PX,
    minTop: headerBottom + UNFOLD_HEADER_GAP_PX,
  });
  if (delta > 0) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // "instant", not "auto": the document's own scroll-behavior may be smooth.
    window.scrollBy({ top: delta, behavior: reduced ? "instant" : "smooth" });
  }
};
/** Once a day the first folded row peeks at «Vi esto» so the swipe is discovered (FIL-I24-1). */
const SWIPE_HINT_KEY = "filmia:ficha-swipe-hint";

const WatchlistFichaImpl = ({
  ficha,
  rank,
  expanded,
  selected,
  stamped,
  stagger,
  desktop,
  hint = false,
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
  // Opening (not a restored open row, not the desktop stage) scrolls the row above the dock.
  const rowRef = useRef<HTMLLIElement>(null);
  const wasExpanded = useRef(expanded);
  useLayoutEffect(() => {
    const opened = expanded && !wasExpanded.current;
    wasExpanded.current = expanded;
    if (opened && !desktop && rowRef.current) {
      revealUnfoldedRow(rowRef.current);
    }
  }, [desktop, expanded]);

  // Both hooks listen to the same pointer events; spread one after the other and the last wins.
  const gestures = composeHandlers<ReactPointerEvent<HTMLDivElement>, [typeof swipe.handlers, typeof longPress]>(
    swipe.handlers,
    longPress,
  );

  // The daily hint: 1.2 s after arrival the folded row peeks at «Vi esto» (CSS keyframes, transform
  // only). Claimed inside the timer so a row that unfolds first, or reduced motion, never spends it.
  const [hinting, setHinting] = useState(false);
  useEffect(() => {
    if (!hint || expanded || stamped) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !claimOncePerDay(SWIPE_HINT_KEY)) {
        return;
      }
      setHinting(true);
    }, HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [expanded, hint, stamped]);

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
      ref={rowRef}
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
      <WatchlistSwipeLayer offset={hinting && !swipe.offset ? 1 : swipe.offset} armed={swipe.armed} />
      <div
        className={cn("ficha-sheet relative isolate rounded-2xl bg-well", hinting && "ficha-swipe-hint")}
        style={swipe.offset ? { transform: `translate3d(${swipe.offset}px, 0, 0)` } : undefined}
        {...gestures}
        onClickCapture={swallowAfterGesture}
        onAnimationEnd={hinting ? () => setHinting(false) : undefined}
      >
        {backdropSrc ? (
          <div className="ficha-backdrop" aria-hidden="true">
            <Image
              src={backdropSrc}
              alt=""
              fill
              sizes="(min-width: 1024px) 640px, 100vw"
              className={cn("object-cover object-[center_30%]", !ficha.backdropPath && "scale-125 blur-2xl")}
              unoptimized={isRemoteImage(backdropSrc)}
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
                    compact
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
