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
 * Frosted side-slot card hinting continuum into the neighboring genre.
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
  const microcopy = direction === "next" ? "Desliza" : "Anterior";
  const arrow = direction === "next" ? "→" : "←";

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
          "coverflow-card-face coverflow-destination-face relative flex h-full w-full cursor-inherit flex-col justify-center gap-2.5 overflow-hidden rounded-[22px] px-3 text-center sm:px-4",
          direction === "next" ? "items-end pr-3 pl-8" : "items-start pl-3 pr-8",
          focusRing,
        )}
      >
        <span className="relative z-[1] max-w-[7.5rem] font-serif text-[1.25rem] leading-tight tracking-tight text-paper sm:text-[1.45rem]">
          {name}
        </span>
        <span
          className="relative z-[1] text-xl leading-none text-paper/90"
          aria-hidden
        >
          {arrow}
        </span>
        <span className="relative z-[1] text-[9px] font-medium uppercase tracking-[0.16em] text-paper/80">
          {microcopy}
        </span>
      </button>
    </article>
  );
});
