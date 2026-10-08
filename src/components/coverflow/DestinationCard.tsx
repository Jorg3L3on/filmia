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
 * Side slot past the first/last card: the poster you land on in the neighboring genre,
 * painted like any other side poster (no label — the genre rail above names it).
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
          "coverflow-card-face coverflow-destination-face relative block h-full w-full cursor-inherit overflow-hidden rounded-[22px]",
          focusRing,
        )}
      >
        <PosterImage
          name={name}
          posterPath={posterPath}
          sizes={COVERFLOW_PAGE_POSTER_SIZES}
          className="absolute inset-0 h-full w-full rounded-none [aspect-ratio:auto]"
        />
        <span data-coverflow-dim className="coverflow-card-dim" aria-hidden />
      </button>
    </article>
  );
});
