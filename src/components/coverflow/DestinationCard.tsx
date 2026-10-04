"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type DestinationCardProps = {
  /** Virtual coverflow index: -1 (prev) or titles.length (next). */
  index: number;
  name: string;
  direction: "prev" | "next";
  onSelect: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  registerNode: (index: number, node: HTMLElement | null) => void;
};

/**
 * Tinted-glass side-slot card hinting continuum into the neighboring genre.
 * Content hugs the outer edge — the hero poster overlaps the inner ~18%.
 * Same footprint as a soft-coverflow side poster; painted by useCoverflowEngine.
 */
export const DestinationCard = memo(function DestinationCard({
  index,
  name,
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
        "coverflow-card coverflow-destination absolute origin-center is-cinematic",
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
          "coverflow-card-face coverflow-destination-face relative flex h-full w-full cursor-inherit flex-col justify-center gap-2 overflow-hidden rounded-[20px] py-4",
          isNext
            ? "items-end pl-[20%] pr-3 text-right"
            : "items-start pl-3 pr-[20%] text-left",
          focusRing,
        )}
      >
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
