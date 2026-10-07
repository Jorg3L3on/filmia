"use client";

import { memo } from "react";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { COVERFLOW_PAGE_POSTER_SIZES } from "@/lib/coverflow-metrics";
import { focusRing } from "@/lib/ui";

type DestinationCardProps = {
  /** Virtual coverflow index: -1 (prev) or titles.length (next). */
  index: number;
  name: string;
  /** Poster of the title the visitor lands on; shown blurred as a peek. */
  posterPath?: string | null;
  direction: "prev" | "next";
  onSelect: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  registerNode: (index: number, node: HTMLElement | null) => void;
};

/**
 * Side-slot "peek" into the neighboring genre: the poster you land on, dimmed and
 * softened, with the genre label over a bottom gradient.
 * Same footprint as a coverflow poster (inset-0); painted by useCoverflowEngine.
 * Poster `sizes` match DeckCard so the browser reuses the cached image on arrival.
 */
export const DestinationCard = memo(function DestinationCard({
  index,
  name,
  posterPath,
  direction,
  onSelect,
  onPointerDown,
  registerNode,
}: DestinationCardProps) {
  const isNext = direction === "next";
  const kicker = isNext ? "Siguiente" : "Anterior";
  const hasLongWord = name.split(/\s+/).some((word) => word.length > 8);

  return (
    <article
      ref={(node) => registerNode(index, node)}
      id={`coverflow-destination-${direction}`}
      role="option"
      aria-label={`${direction === "next" ? "Siguiente" : "Anterior"} categoría: ${name}`}
      aria-selected="false"
      data-coverflow-destination={direction}
      className={cn(
        "coverflow-card coverflow-destination absolute inset-0 origin-center is-cinematic",
      )}
      onPointerDown={onPointerDown}
    >
      <button
        type="button"
        data-coverflow-face
        tabIndex={-1}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }}
        className={cn(
          "coverflow-card-face coverflow-destination-face relative flex h-full w-full cursor-inherit flex-col justify-end gap-1.5 overflow-hidden rounded-[22px] pb-5 pt-4",
          // Label sits toward the hero: the outer half of the card is off-screen.
          isNext
            ? "items-start pl-[56%] pr-2 text-left"
            : "items-end pl-2 pr-[56%] text-right",
          focusRing,
        )}
      >
        <span className="coverflow-destination-peek" aria-hidden>
          <PosterImage
            name={name}
            posterPath={posterPath}
            sizes={COVERFLOW_PAGE_POSTER_SIZES}
            className="absolute inset-0 h-full w-full rounded-none [aspect-ratio:auto]"
          />
        </span>
        <span className="coverflow-destination-scrim" aria-hidden />
        <span className="coverflow-destination-kicker relative z-[1]">
          {kicker}
        </span>
        <span
          className={cn(
            "coverflow-destination-name relative z-[1] font-serif",
            hasLongWord && "is-long",
          )}
        >
          {name}
        </span>
        <span className="coverflow-destination-arrow relative z-[1]" aria-hidden>
          <svg viewBox="0 0 16 16" fill="none" className="size-3.5">
            <path
              d={isNext ? "M3 8h10M9 4l4 4-4 4" : "M13 8H3M7 4 3 8l4 4"}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
    </article>
  );
});
